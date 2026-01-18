import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { ClimateStateDataModel } from '../models/spaces-response.model';
import {
	ClimateIntentType,
	ClimateMode,
	ClimateRole,
	EventType,
	SETPOINT_DELTA_STEPS,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { IntentSpecLoaderService } from '../spec';

import { ClimateState, PrimaryClimateDevice, SpaceClimateStateService } from './space-climate-state.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

// Re-export types for backwards compatibility
export { ClimateState, PrimaryClimateDevice } from './space-climate-state.service';

/**
 * Result of a climate intent execution.
 */
export interface ClimateIntentResult extends IntentExecutionResult {
	mode: ClimateMode;
	newSetpoint: number | null;
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
}

/**
 * Service handling all climate-related intent operations.
 * Manages multi-device climate control, mode switching, and setpoint adjustments.
 */
@Injectable()
export class ClimateIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'ClimateIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		@Inject(forwardRef(() => SpaceClimateStateService))
		private readonly climateStateService: SpaceClimateStateService,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		private readonly eventEmitter: EventEmitter2,
		private readonly intentSpecLoaderService: IntentSpecLoaderService,
	) {
		super();
	}

	/**
	 * Get the current climate state for a space.
	 * Delegates to SpaceClimateStateService.
	 */
	async getClimateState(spaceId: string): Promise<ClimateState | null> {
		return this.climateStateService.getClimateState(spaceId);
	}

	/**
	 * Execute a climate intent for the space.
	 * Supports multi-device control based on mode and roles.
	 * Returns null if space doesn't exist (controller should throw 404).
	 */
	async executeClimateIntent(spaceId: string, intent: ClimateIntentDto): Promise<ClimateIntentResult | null> {
		const defaultResult: ClimateIntentResult = {
			success: false,
			affectedDevices: 0,
			failedDevices: 0,
			mode: ClimateMode.OFF,
			newSetpoint: null,
			heatingSetpoint: null,
			coolingSetpoint: null,
		};

		// Verify space exists - return null for controller to throw 404
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get current climate state
		const climateState = await this.climateStateService.getClimateState(spaceId);

		if (!climateState || !climateState.hasClimate) {
			this.logger.debug(`No climate devices in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		// Get primary devices
		const primaryDevices = await this.climateStateService.getPrimaryClimateDevicesInSpace(spaceId);

		if (primaryDevices.length === 0) {
			this.logger.debug(`No controllable climate devices in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		// Capture snapshot for undo BEFORE executing the climate intent
		await this.captureUndoSnapshot(spaceId, intent);

		// Handle different intent types
		let result: ClimateIntentResult;

		switch (intent.type) {
			case ClimateIntentType.SET_MODE:
				result = await this.executeSetModeIntent(spaceId, primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.SETPOINT_SET:
				result = await this.executeSetpointSetIntent(primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.SETPOINT_DELTA:
				result = await this.executeSetpointDeltaIntent(primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.CLIMATE_SET:
				result = await this.executeClimateSetIntent(spaceId, primaryDevices, intent, climateState);
				break;

			default:
				this.logger.warn(`Unknown climate intent type: ${String(intent.type)}`);
				return defaultResult;
		}

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitClimateStateChange(spaceId);
		}

		return result;
	}

	/**
	 * Get the primary thermostat device ID for a space (legacy method for undo service).
	 * @deprecated Use SpaceClimateStateService.getPrimaryClimateDevicesInSpace instead
	 */
	async getPrimaryThermostatId(spaceId: string): Promise<string | null> {
		const primaryDevices = await this.climateStateService.getPrimaryClimateDevicesInSpace(spaceId);

		// Return first device that supports setpoint control
		for (const device of primaryDevices) {
			if (device.heaterSetpointProperty || device.coolerSetpointProperty) {
				return device.device.id;
			}
		}

		return null;
	}

	// =====================
	// Private Methods
	// =====================

	/**
	 * Execute SET_MODE intent - change climate mode on all applicable devices.
	 */
	private async executeSetModeIntent(
		spaceId: string,
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		const mode = intent.mode ?? ClimateMode.OFF;
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const device of devices) {
			const success = await this.setDeviceMode(device, mode);
			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		// Store mode change to InfluxDB for historical tracking (fire and forget)
		if (overallSuccess) {
			void this.intentTimeseriesService.storeClimateModeChange(
				spaceId,
				mode,
				devices.length,
				affectedDevices,
				failedDevices,
			);
		}

		return {
			success: overallSuccess,
			affectedDevices,
			failedDevices,
			mode,
			newSetpoint: climateState.targetTemperature,
			heatingSetpoint: climateState.heatingSetpoint,
			coolingSetpoint: climateState.coolingSetpoint,
		};
	}

	/**
	 * Set mode on a single device.
	 */
	private async setDeviceMode(device: PrimaryClimateDevice, mode: ClimateMode): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (mode) {
			case ClimateMode.OFF:
				// Turn off heater
				if (device.heaterOnProperty && device.heaterChannel) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: false,
					});
				}
				// Turn off cooler
				if (device.coolerOnProperty && device.coolerChannel) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: false,
					});
				}
				break;

			case ClimateMode.HEAT:
				// Turn on heater, turn off cooler
				if (device.heaterOnProperty && device.heaterChannel && device.supportsHeating) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: true,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: false,
					});
				}
				break;

			case ClimateMode.COOL:
				// Turn off heater, turn on cooler
				if (device.heaterOnProperty && device.heaterChannel) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: false,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel && device.supportsCooling) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: true,
					});
				}
				break;

			case ClimateMode.AUTO:
				// Turn on both heater and cooler
				if (device.heaterOnProperty && device.heaterChannel && device.supportsHeating) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: true,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel && device.supportsCooling) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: true,
					});
				}
				break;
		}

		if (commands.length === 0) {
			this.logger.debug(`No mode commands for device id=${device.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);
			if (!success) {
				this.logger.error(`Mode command execution failed for device id=${device.device.id}`);
				return false;
			}
			return true;
		} catch (error) {
			this.logger.error(`Error executing mode command for device id=${device.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Execute SETPOINT_SET intent - set temperature on all applicable devices.
	 */
	private async executeSetpointSetIntent(
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		// Use lastAppliedMode (user's intent) if available, as detected mode may be stale
		// immediately after a mode change (devices take time to update their state)
		const mode = climateState.lastAppliedMode ?? climateState.mode;
		let affectedDevices = 0;
		let failedDevices = 0;

		this.logger.debug(
			`executeSetpointSetIntent: heatingSetpoint=${intent.heatingSetpoint}, coolingSetpoint=${intent.coolingSetpoint}, ` +
				`lastAppliedMode=${climateState.lastAppliedMode}, detectedMode=${climateState.mode}, effectiveMode=${mode}`,
		);

		// Determine setpoints based on intent
		// The panel sends heatingSetpoint for heat/off modes, coolingSetpoint for cool mode,
		// and both for auto mode
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
			// AUTO mode with explicit setpoints for both
			heatingSetpoint = this.clampSetpoint(intent.heatingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
			coolingSetpoint = this.clampSetpoint(intent.coolingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		} else if (intent.heatingSetpoint !== undefined) {
			// Only heating setpoint provided - apply to heating devices
			heatingSetpoint = this.clampSetpoint(intent.heatingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		} else if (intent.coolingSetpoint !== undefined) {
			// Only cooling setpoint provided - apply to cooling devices
			coolingSetpoint = this.clampSetpoint(intent.coolingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		}

		this.logger.debug(
			`executeSetpointSetIntent: determined heatingSetpoint=${heatingSetpoint}, coolingSetpoint=${coolingSetpoint}`,
		);

		// Apply setpoints to devices based on their roles and capabilities
		for (const device of devices) {
			const role = device.role ?? ClimateRole.AUTO; // null = AUTO

			// Determine if this device should receive heating setpoint
			const shouldSetHeating =
				heatingSetpoint !== null &&
				device.supportsHeating &&
				(role === ClimateRole.AUTO || role === ClimateRole.HEATING_ONLY || role === null);

			// Determine if this device should receive cooling setpoint
			const shouldSetCooling =
				coolingSetpoint !== null &&
				device.supportsCooling &&
				(role === ClimateRole.AUTO || role === ClimateRole.COOLING_ONLY || role === null);

			if (!shouldSetHeating && !shouldSetCooling) {
				continue;
			}

			const success = await this.setDeviceSetpoints(
				device,
				shouldSetHeating ? heatingSetpoint : null,
				shouldSetCooling ? coolingSetpoint : null,
			);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		// Determine the "primary" setpoint for the response
		const newSetpoint =
			mode === ClimateMode.HEAT ? heatingSetpoint : mode === ClimateMode.COOL ? coolingSetpoint : heatingSetpoint;

		return {
			success: failedDevices === 0 || affectedDevices > 0,
			affectedDevices,
			failedDevices,
			mode,
			newSetpoint,
			heatingSetpoint,
			coolingSetpoint,
		};
	}

	/**
	 * Execute SETPOINT_DELTA intent - adjust temperature on all applicable devices.
	 */
	private async executeSetpointDeltaIntent(
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		if (intent.delta === undefined || intent.increase === undefined) {
			this.logger.warn('SETPOINT_DELTA intent requires delta and increase parameters');
			return {
				success: false,
				affectedDevices: 0,
				failedDevices: 0,
				mode: climateState.mode,
				newSetpoint: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
			};
		}

		// Get delta value from YAML spec first, fall back to hardcoded constants
		const yamlDeltaValue = this.intentSpecLoaderService.getSetpointDeltaStep(intent.delta);
		const deltaValue = yamlDeltaValue ?? SETPOINT_DELTA_STEPS[intent.delta];

		// Validate delta lookup to prevent NaN from propagating
		if (deltaValue === undefined || deltaValue === null) {
			this.logger.error(`Invalid setpoint delta value: ${intent.delta}`);
			return {
				success: false,
				affectedDevices: 0,
				failedDevices: 0,
				mode: climateState.mode,
				newSetpoint: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
			};
		}

		// Calculate new setpoints based on current values
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		if (climateState.heatingSetpoint !== null) {
			const newValue = intent.increase
				? climateState.heatingSetpoint + deltaValue
				: climateState.heatingSetpoint - deltaValue;
			heatingSetpoint = this.clampSetpoint(newValue, climateState.minSetpoint, climateState.maxSetpoint);
		}

		if (climateState.coolingSetpoint !== null) {
			const newValue = intent.increase
				? climateState.coolingSetpoint + deltaValue
				: climateState.coolingSetpoint - deltaValue;
			coolingSetpoint = this.clampSetpoint(newValue, climateState.minSetpoint, climateState.maxSetpoint);
		}

		// Use the same logic as SETPOINT_SET
		const setIntent: ClimateIntentDto = {
			type: ClimateIntentType.SETPOINT_SET,
			heatingSetpoint: heatingSetpoint ?? undefined,
			coolingSetpoint: coolingSetpoint ?? undefined,
		};

		return this.executeSetpointSetIntent(devices, setIntent, climateState);
	}

	/**
	 * Set setpoints on a single device.
	 */
	private async setDeviceSetpoints(
		device: PrimaryClimateDevice,
		heatingSetpoint: number | null,
		coolingSetpoint: number | null,
	): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		// Set heating setpoint
		if (heatingSetpoint !== null && device.heaterSetpointProperty && device.heaterChannel) {
			this.logger.debug(
				`setDeviceSetpoints: device=${device.device.id}, heatingSetpoint=${heatingSetpoint}, ` +
					`heaterMin=${device.heaterMinSetpoint}, heaterMax=${device.heaterMaxSetpoint}`,
			);
			const clampedValue = this.clampSetpoint(heatingSetpoint, device.heaterMinSetpoint, device.heaterMaxSetpoint);
			this.logger.debug(`setDeviceSetpoints: clampedValue=${clampedValue}`);
			commands.push({
				device: device.device,
				channel: device.heaterChannel,
				property: device.heaterSetpointProperty,
				value: clampedValue,
			});
		} else if (heatingSetpoint !== null) {
			this.logger.debug(
				`Cannot set heating setpoint on device id=${device.device.id}: ` +
					`heaterChannel=${device.heaterChannel?.id ?? 'null'}, ` +
					`heaterSetpointProperty=${device.heaterSetpointProperty?.id ?? 'null'}`,
			);
		}

		// Set cooling setpoint
		if (coolingSetpoint !== null && device.coolerSetpointProperty && device.coolerChannel) {
			this.logger.debug(
				`setDeviceSetpoints: device=${device.device.id}, coolingSetpoint=${coolingSetpoint}, ` +
					`coolerMin=${device.coolerMinSetpoint}, coolerMax=${device.coolerMaxSetpoint}`,
			);
			const clampedValue = this.clampSetpoint(coolingSetpoint, device.coolerMinSetpoint, device.coolerMaxSetpoint);
			this.logger.debug(`setDeviceSetpoints: cooler clampedValue=${clampedValue}`);
			commands.push({
				device: device.device,
				channel: device.coolerChannel,
				property: device.coolerSetpointProperty,
				value: clampedValue,
			});
		} else if (coolingSetpoint !== null) {
			this.logger.debug(
				`Cannot set cooling setpoint on device id=${device.device.id}: ` +
					`coolerChannel=${device.coolerChannel?.id ?? 'null'}, ` +
					`coolerSetpointProperty=${device.coolerSetpointProperty?.id ?? 'null'}`,
			);
		}

		if (commands.length === 0) {
			this.logger.debug(`No setpoint commands for device id=${device.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);
			if (!success) {
				this.logger.error(`Setpoint command execution failed for device id=${device.device.id}`);
				return false;
			}

			this.logger.debug(
				`Set setpoints on device id=${device.device.id} heating=${heatingSetpoint} cooling=${coolingSetpoint}`,
			);
			return true;
		} catch (error) {
			this.logger.error(`Error executing setpoint command for device id=${device.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Clamp and round setpoint value.
	 */
	private clampSetpoint(value: number, min: number, max: number): number {
		// Clamp to min/max
		let clamped = Math.max(min, Math.min(max, value));
		// Round to 0.5 degree precision
		clamped = Math.round(clamped * 2) / 2;
		// Re-clamp after rounding
		return Math.max(min, Math.min(max, clamped));
	}

	/**
	 * Execute CLIMATE_SET intent - set mode and/or setpoints in a single atomic operation.
	 * This allows setting multiple climate properties at once (e.g., mode + setpoint).
	 */
	private async executeClimateSetIntent(
		spaceId: string,
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		// Track mode and setpoint changes separately
		let modeAffected = 0;
		let modeFailed = 0;
		let setpointAffected = 0;
		let setpointFailed = 0;
		// Use intent.mode if provided, otherwise use lastAppliedMode (user's intent) if available,
		// as detected mode may be stale immediately after a mode change
		const mode = intent.mode ?? climateState.lastAppliedMode ?? climateState.mode;
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		// Step 1: Set mode if provided
		if (intent.mode !== undefined) {
			for (const device of devices) {
				const success = await this.setDeviceMode(device, intent.mode);
				if (success) {
					modeAffected++;
				} else {
					modeFailed++;
				}
			}

			// Store mode change to InfluxDB
			if (modeAffected > 0) {
				void this.intentTimeseriesService.storeClimateModeChange(
					spaceId,
					intent.mode,
					devices.length,
					modeAffected,
					modeFailed,
				);
			}
		}

		// Step 2: Set setpoints if provided
		const hasSetpoints = intent.heatingSetpoint !== undefined || intent.coolingSetpoint !== undefined;

		if (hasSetpoints) {
			// Determine setpoints based on intent and mode
			if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
				// Explicit dual setpoints for AUTO mode
				heatingSetpoint = this.clampSetpoint(
					intent.heatingSetpoint,
					climateState.minSetpoint,
					climateState.maxSetpoint,
				);
				coolingSetpoint = this.clampSetpoint(
					intent.coolingSetpoint,
					climateState.minSetpoint,
					climateState.maxSetpoint,
				);
			} else {
				// Only one of heating/cooling setpoint provided
				if (intent.heatingSetpoint !== undefined) {
					heatingSetpoint = this.clampSetpoint(
						intent.heatingSetpoint,
						climateState.minSetpoint,
						climateState.maxSetpoint,
					);
				}
				if (intent.coolingSetpoint !== undefined) {
					coolingSetpoint = this.clampSetpoint(
						intent.coolingSetpoint,
						climateState.minSetpoint,
						climateState.maxSetpoint,
					);
				}
			}

			// Apply setpoints to devices based on their roles and capabilities
			for (const device of devices) {
				const role = device.role ?? ClimateRole.AUTO;

				const shouldSetHeating =
					heatingSetpoint !== null &&
					device.supportsHeating &&
					(role === ClimateRole.AUTO || role === ClimateRole.HEATING_ONLY || role === null);

				const shouldSetCooling =
					coolingSetpoint !== null &&
					device.supportsCooling &&
					(role === ClimateRole.AUTO || role === ClimateRole.COOLING_ONLY || role === null);

				if (!shouldSetHeating && !shouldSetCooling) {
					continue;
				}

				const success = await this.setDeviceSetpoints(
					device,
					shouldSetHeating ? heatingSetpoint : null,
					shouldSetCooling ? coolingSetpoint : null,
				);

				if (success) {
					setpointAffected++;
				} else {
					setpointFailed++;
				}
			}
		}

		// Combine mode and setpoint counts for the response
		// This ensures the response accurately reflects all changes made
		const totalAffected = modeAffected + setpointAffected;
		const totalFailed = modeFailed + setpointFailed;

		// Determine the "primary" setpoint for the response
		const newSetpoint =
			mode === ClimateMode.HEAT ? heatingSetpoint : mode === ClimateMode.COOL ? coolingSetpoint : heatingSetpoint;

		return {
			success: totalFailed === 0 || totalAffected > 0,
			affectedDevices: totalAffected,
			failedDevices: totalFailed,
			mode,
			newSetpoint,
			heatingSetpoint,
			coolingSetpoint,
		};
	}

	/**
	 * Capture a snapshot for undo before executing a climate intent.
	 */
	private async captureUndoSnapshot(spaceId: string, intent: ClimateIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				this.logger.debug(`Could not capture snapshot for undo spaceId=${spaceId}`);

				return;
			}

			const actionDescription = this.buildIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'climate');

			this.logger.debug(`Undo snapshot captured spaceId=${spaceId} action="${actionDescription}"`);
		} catch (error) {
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Build a human-readable description of a climate intent.
	 */
	private buildIntentDescription(intent: ClimateIntentDto): string {
		switch (intent.type) {
			case ClimateIntentType.SET_MODE:
				return `Set climate mode to ${intent.mode ?? 'unknown'}`;
			case ClimateIntentType.SETPOINT_DELTA:
				return intent.increase ? 'Increase temperature' : 'Decrease temperature';
			case ClimateIntentType.SETPOINT_SET:
				if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
					return `Set temperature range ${intent.heatingSetpoint}°C - ${intent.coolingSetpoint}°C`;
				}
				if (intent.heatingSetpoint !== undefined) {
					return `Set heating temperature to ${intent.heatingSetpoint}°C`;
				}
				if (intent.coolingSetpoint !== undefined) {
					return `Set cooling temperature to ${intent.coolingSetpoint}°C`;
				}
				return 'Set temperature';
			case ClimateIntentType.CLIMATE_SET: {
				const parts: string[] = [];
				if (intent.mode !== undefined) {
					parts.push(`mode to ${intent.mode}`);
				}
				if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
					parts.push(`range ${intent.heatingSetpoint}°C - ${intent.coolingSetpoint}°C`);
				} else if (intent.heatingSetpoint !== undefined) {
					parts.push(`heating to ${intent.heatingSetpoint}°C`);
				} else if (intent.coolingSetpoint !== undefined) {
					parts.push(`cooling to ${intent.coolingSetpoint}°C`);
				}
				return parts.length > 0 ? `Set climate ${parts.join(', ')}` : 'Set climate properties';
			}
			default:
				return 'Climate intent';
		}
	}

	/**
	 * Emit climate state change event for WebSocket clients.
	 * Fetches the latest climate state and emits it via the event emitter.
	 */
	private async emitClimateStateChange(spaceId: string): Promise<void> {
		try {
			const state = await this.climateStateService.getClimateState(spaceId);

			if (state && state.hasClimate) {
				// Convert to ClimateStateDataModel for proper snake_case serialization via WebSocket
				const stateModel = toInstance(ClimateStateDataModel, state);

				this.eventEmitter.emit(EventType.CLIMATE_STATE_CHANGED, {
					space_id: spaceId,
					state: stateModel,
				});

				this.logger.debug(`Emitted climate state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit climate state change event spaceId=${spaceId}: ${error}`);
		}
	}
}
