import { Injectable, Logger } from '@nestjs/common';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { SceneActionEntity, SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { ActionExecutionResultModel } from '../../../modules/scenes/models/scenes.model';
import {
	ScenesActionValidationException,
	ScenesSpaceValidationException,
} from '../../../modules/scenes/scenes.exceptions';
import { IScenePlatform } from '../../../modules/scenes/services/scene-executor.service';
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
	private readonly logger = new Logger(`${SCENES_LOCAL_PLUGIN_NAME}:${LocalScenePlatform.name}`);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly spacesService: SpacesService,
	) {}

	getType(): string {
		return SCENES_LOCAL_TYPE;
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

				if (!validation.valid || !validation.device || !validation.property) {
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

				// Send command to device via platform
				const success = await platform.process({
					device,
					channel,
					property,
					value: action.value,
				});

				results.push({
					actionId: action.id,
					success,
					error: success ? null : 'Command execution failed',
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
