import { Injectable, Optional } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { CompositePropertyCommandRegistryService } from '../../../modules/devices/services/composite-property-command.registry.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { DEFAULT_TTL_SCENE } from '../../../modules/intents/intents.constants';
import { SceneActionEntity, SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { ActionExecutionResultModel } from '../../../modules/scenes/models/scenes.model';
import {
	ScenesActionValidationException,
	ScenesSpaceValidationException,
} from '../../../modules/scenes/scenes.exceptions';
import { IScenePlatform, SceneExecutionContext } from '../../../modules/scenes/services/scene-executor.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { LocalSceneActionEntity } from '../entities/scenes-local.entity';
import { SCENES_LOCAL_PLUGIN_NAME, SCENES_LOCAL_TYPE } from '../scenes-local.constants';

export interface IActionValidationResult {
	valid: boolean;
	error?: string;
	device?: DeviceEntity;
	channel?: ChannelEntity;
	property?: ChannelPropertyEntity;
}

/**
 * Type guard to check if action is a LocalSceneActionEntity
 */
function isLocalSceneAction(action: SceneActionEntity): action is LocalSceneActionEntity {
	return action.type === SCENES_LOCAL_TYPE && 'deviceId' in action && 'propertyId' in action && 'value' in action;
}

@Injectable()
export class LocalScenePlatform implements IScenePlatform {
	private readonly logger = createExtensionLogger(SCENES_LOCAL_PLUGIN_NAME, 'LocalScenePlatform');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly propertyCommandDispatchService: PropertyCommandDispatchService,
		private readonly spacesService: SpacesService,
		@Optional() private readonly composites?: CompositePropertyCommandRegistryService,
	) {}

	getType(): string {
		return SCENES_LOCAL_TYPE;
	}

	supportsAdjacentActions(): boolean {
		return true;
	}

	async getCommandTtlMs(actions: readonly SceneActionEntity[]): Promise<number> {
		const executions = [];
		const compositeUpdates: IDevicePropertyData[] = [];

		for (const action of actions) {
			const validation = await this.validateActionWithDetails(action);

			if (validation.valid && validation.device !== undefined) {
				executions.push({ device: validation.device, commandCount: 1 });
				if (this.composites?.get(validation.property) && isLocalSceneAction(action))
					compositeUpdates.push({
						device: validation.device,
						channel: validation.channel,
						property: validation.property,
						value: action.value,
					});
			}
		}

		const compositeBudget = compositeUpdates.length ? await this.composites.estimateTimeoutMs(compositeUpdates) : null;
		return Math.max(compositeBudget ?? 0, this.platformRegistryService.getCommandTtlMs(executions, DEFAULT_TTL_SCENE));
	}

	/**
	 * Validate that a space exists and is of type ROOM
	 */
	async validateSpace(spaceId: string): Promise<void> {
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			throw new ScenesSpaceValidationException(`Space with id=${spaceId} not found.`);
		}

		if (space.type !== SpaceType.ROOM) {
			throw new ScenesSpaceValidationException(
				`Space with id=${spaceId} is not a room. Scenes can only be assigned to rooms.`,
			);
		}
	}

	/**
	 * Validate a single action and return device/channel/property references
	 */
	async validateAction(action: SceneActionEntity): Promise<boolean> {
		const result = await this.validateActionWithDetails(action);
		return result.valid;
	}

	/**
	 * Validate action and return details for execution
	 */
	async validateActionWithDetails(action: SceneActionEntity): Promise<IActionValidationResult> {
		// Verify this is a local scene action
		if (!isLocalSceneAction(action)) {
			return {
				valid: false,
				error: 'Invalid action type. Expected local scene action with deviceId, propertyId, and value.',
			};
		}

		// Validate device exists
		const device = await this.devicesService.findOne(action.deviceId);

		if (!device) {
			return {
				valid: false,
				error: 'Referenced device no longer exists',
			};
		}

		// Validate channel exists (if provided) or find default
		let channel: ChannelEntity | null = null;

		if (action.channelId) {
			channel = await this.channelsService.findOne(action.channelId, action.deviceId);

			if (!channel) {
				return {
					valid: false,
					error: 'Referenced channel no longer exists',
				};
			}
		} else {
			// Try to find the channel that contains the property
			const channels = await this.channelsService.findAll(action.deviceId);

			for (const ch of channels) {
				const prop = await this.channelsPropertiesService.findOne(action.propertyId, ch.id);

				if (prop) {
					channel = ch;
					break;
				}
			}

			if (!channel) {
				return {
					valid: false,
					error: 'Referenced channel no longer exists',
				};
			}
		}

		// Validate property exists
		const property = await this.channelsPropertiesService.findOne(action.propertyId, channel.id);

		if (!property) {
			return {
				valid: false,
				error: 'Referenced property no longer exists',
			};
		}

		// Validate property is writable
		const isWritable = property.permissions?.some(
			(p) => p === PermissionType.READ_WRITE || p === PermissionType.WRITE_ONLY,
		);

		if (!isWritable && !this.composites?.get(property)) {
			return {
				valid: false,
				error: 'Referenced property is not writable',
			};
		}

		// Validate value type matches property data type
		const valueTypeValid = this.validateValueType(property, action.value);

		if (!valueTypeValid) {
			return {
				valid: false,
				error: `Value type mismatch (expected ${property.dataType})`,
			};
		}

		return {
			valid: true,
			device,
			channel,
			property,
		};
	}

	/**
	 * Validate that value type matches property data type
	 */
	private validateValueType(property: ChannelPropertyEntity, value: string | number | boolean): boolean {
		const dataType = property.dataType?.toLowerCase();

		switch (dataType) {
			case 'bool':
			case 'boolean':
				return typeof value === 'boolean';
			case 'int':
			case 'uint':
			case 'short':
			case 'ushort':
			case 'char':
			case 'uchar':
			case 'float':
				return typeof value === 'number';
			case 'string':
				return typeof value === 'string';
			case 'enum':
				// For enum, value should be string and match one of the format values
				if (typeof value !== 'string') return false;
				if (property.format && Array.isArray(property.format)) {
					return (property.format as unknown[]).includes(value);
				}
				return true;
			default:
				// Unknown type - allow any value
				return true;
		}
	}

	/**
	 * Execute scene actions by sending commands to devices
	 */
	async execute(
		scene: SceneEntity,
		actions: SceneActionEntity[],
		context?: SceneExecutionContext,
	): Promise<ActionExecutionResultModel[]> {
		const results: ActionExecutionResultModel[] = [];

		for (let index = 0; index < actions.length; index++) {
			const action = actions[index];
			const startTime = Date.now();

			try {
				// Verify this is a local scene action
				if (!isLocalSceneAction(action)) {
					results.push({
						actionId: action.id,
						success: false,
						error: 'Invalid action type. Expected local scene action with deviceId, propertyId, and value.',
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}

				// Validate action first
				const validation = await this.validateActionWithDetails(action);

				if (!validation.valid || !validation.device || !validation.channel || !validation.property) {
					results.push({
						actionId: action.id,
						success: false,
						error: validation.error || 'Validation failed',
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}

				const device = validation.device;
				const channel = validation.channel;
				const property = validation.property;

				// Get the platform handler for this device
				const platform = this.platformRegistryService.get(device);

				if (!platform) {
					results.push({
						actionId: action.id,
						success: false,
						error: `No platform handler found for device type: ${device.type}`,
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}
				if (
					device.type === 'virtual' &&
					(device as DeviceEntity & { mode?: string }).mode === 'climate_controller' &&
					property.category !== PropertyCategory.LOCKED
				) {
					const grouped: Array<{ action: LocalSceneActionEntity; update: IDevicePropertyData }> = [
						{ action, update: { device, channel, property, value: action.value } },
					];
					const propertyIds = new Set([property.id]);
					while (index + grouped.length < actions.length) {
						const next = actions[index + grouped.length];
						if (!isLocalSceneAction(next) || next.deviceId !== device.id || propertyIds.has(next.propertyId)) break;
						const resolved = await this.validateActionWithDetails(next);
						if (
							!resolved.valid ||
							!resolved.channel ||
							!resolved.property ||
							resolved.property.category === PropertyCategory.LOCKED
						)
							break;
						grouped.push({
							action: next,
							update: {
								device: resolved.device,
								channel: resolved.channel,
								property: resolved.property,
								value: next.value,
							},
						});
						propertyIds.add(next.propertyId);
					}
					if (grouped.length > 1) {
						let success = false;
						let error: string | null = 'Command execution failed';
						try {
							const updates = grouped.map(({ update }) => update);
							const dispatched = context
								? await this.propertyCommandDispatchService.dispatchBatch(updates, {
										...context,
										ttlMs: context.deadlineAt - Date.now(),
									})
								: await this.propertyCommandDispatchService.dispatchBatch(updates);
							success = dispatched.success;
							if (success) error = null;
						} catch (failure) {
							error = failure instanceof Error ? failure.message : 'Command execution failed';
						}
						for (const { action: member } of grouped)
							results.push({
								actionId: member.id,
								success,
								error,
								executionTimeMs: Date.now() - startTime,
							});
						index += grouped.length - 1;
						continue;
					}
				}

				// Send command to device via platform
				const ttlMs = this.composites?.get(property)
					? await this.composites.estimateTimeoutMs([{ device, channel, property, value: action.value }])
					: null;
				const updates = [{ device, channel, property, value: action.value }];
				const { success, composite } =
					ttlMs === null
						? context
							? await this.propertyCommandDispatchService.dispatchBatch(updates, {
									...context,
									ttlMs: context.deadlineAt - Date.now(),
								})
							: await this.propertyCommandDispatchService.dispatchBatch(updates)
						: await this.propertyCommandDispatchService.dispatchBatch(updates, {
								intentId: context?.intentId,
								ttlMs: Math.min(ttlMs, context ? context.deadlineAt - Date.now() : Infinity),
								deadlineAt: context?.deadlineAt,
							});

				results.push({
					actionId: action.id,
					success,
					error: success ? null : 'Command execution failed',
					composite,
					executionTimeMs: Date.now() - startTime,
				});
			} catch (error) {
				const err = error as Error;

				this.logger.error(`[EXECUTE] Action ${action.id} failed: ${err.message}`);

				results.push({
					actionId: action.id,
					success: false,
					error: err.message,
					executionTimeMs: Date.now() - startTime,
				});
			}
		}

		return results;
	}

	/**
	 * Validate all actions in a scene before saving
	 */
	async validateSceneActions(actions: SceneActionEntity[]): Promise<void> {
		for (const action of actions) {
			const result = await this.validateActionWithDetails(action);

			if (!result.valid) {
				throw new ScenesActionValidationException(result.error || 'Action validation failed');
			}
		}
	}
}
