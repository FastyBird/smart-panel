import { Injectable, Logger } from '@nestjs/common';

import { PermissionType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType } from '../../spaces/spaces.constants';
import { SceneActionEntity, SceneEntity } from '../entities/scenes.entity';
import { ActionExecutionResultModel } from '../models/scenes.model';
import { ScenesActionValidationException, ScenesSpaceValidationException } from '../scenes.exceptions';

import { IScenePlatform } from './scene-executor.service';

export const LOCAL_SCENES_PLATFORM_TYPE = 'sceneactionentity';

export interface IActionValidationResult {
	valid: boolean;
	error?: string;
	device?: DeviceEntity;
	channel?: ChannelEntity;
	property?: ChannelPropertyEntity;
}

@Injectable()
export class LocalScenesPlatformService implements IScenePlatform {
	private readonly logger = new Logger(LocalScenesPlatformService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly spacesService: SpacesService,
	) {}

	getType(): string {
		return LOCAL_SCENES_PLATFORM_TYPE;
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
		// Validate device exists
		const device = await this.devicesService.findOne(action.deviceId);

		if (!device) {
			return {
				valid: false,
				error: `Device with id=${action.deviceId} not found.`,
			};
		}

		// Validate channel exists (if provided) or find default
		let channel: ChannelEntity | null = null;

		if (action.channelId) {
			channel = await this.channelsService.findOne(action.channelId, action.deviceId);

			if (!channel) {
				return {
					valid: false,
					error: `Channel with id=${action.channelId} not found for device id=${action.deviceId}.`,
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
					error: `Could not find channel containing property id=${action.propertyId} for device id=${action.deviceId}.`,
				};
			}
		}

		// Validate property exists
		const property = await this.channelsPropertiesService.findOne(action.propertyId, channel.id);

		if (!property) {
			return {
				valid: false,
				error: `Property with id=${action.propertyId} not found in channel id=${channel.id}.`,
			};
		}

		// Validate property is writable
		const isWritable = property.permissions?.some(
			(p) => p === PermissionType.READ_WRITE || p === PermissionType.WRITE_ONLY,
		);

		if (!isWritable) {
			return {
				valid: false,
				error: `Property with id=${action.propertyId} is not writable. Permissions: ${property.permissions?.join(', ') || 'none'}.`,
			};
		}

		// Validate value type matches property data type
		const valueTypeValid = this.validateValueType(property, action.value);

		if (!valueTypeValid) {
			return {
				valid: false,
				error: `Value type mismatch for property id=${action.propertyId}. Expected ${property.dataType}, got ${typeof action.value}.`,
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
	async execute(scene: SceneEntity, actions: SceneActionEntity[]): Promise<ActionExecutionResultModel[]> {
		const results: ActionExecutionResultModel[] = [];

		for (const action of actions) {
			const startTime = Date.now();

			try {
				// Validate action first
				const validation = await this.validateActionWithDetails(action);

				if (!validation.valid) {
					results.push({
						actionId: action.id,
						success: false,
						error: validation.error || 'Validation failed',
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}

				const { device, channel, property } = validation;

				// Get the platform handler for this device
				const platform = this.platformRegistryService.get(device!);

				if (!platform) {
					results.push({
						actionId: action.id,
						success: false,
						error: `No platform handler found for device type: ${device!.type}`,
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}

				// Send command to device via platform
				const success = await platform.process({
					device: device!,
					channel: channel!,
					property: property!,
					value: action.value,
				});

				results.push({
					actionId: action.id,
					success,
					error: success ? null : 'Command execution failed',
					executionTimeMs: Date.now() - startTime,
				});

				this.logger.debug(
					`[EXECUTE] Action ${action.id}: device=${device!.id}, property=${property!.id}, value=${action.value}, success=${success}`,
				);
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
