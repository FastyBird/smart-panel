import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelSpecModel } from '../../../modules/devices/models/devices.model';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { channelsSchema } from '../../../spec/channels';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { CreateHomeAssistantChannelDto } from '../dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from '../dto/create-device.dto';
import { AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { HomeAssistantWsService } from './home-assistant.ws.service';

/**
 * Service for adopting (creating) Smart Panel devices from Home Assistant devices
 *
 * This service creates the complete device hierarchy (device, channels, properties)
 * based on the confirmed mapping from the user.
 */
@Injectable()
export class DeviceAdoptionService {
	private readonly logger = new Logger(DeviceAdoptionService.name);

	private readonly CONNECTION_TYPE_MAP: Record<string, 'wired' | 'wifi' | 'zigbee' | 'bluetooth'> = {
		mac: 'wifi',
		ethernet: 'wired',
		zigbee: 'zigbee',
		bluetooth: 'bluetooth',
	};

	constructor(
		private readonly homeAssistantWsService: HomeAssistantWsService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
	) {}

	/**
	 * Adopt a Home Assistant device into the Smart Panel system
	 */
	async adoptDevice(request: AdoptDeviceRequestDto): Promise<HomeAssistantDeviceEntity> {
		this.logger.debug(`[DEVICE ADOPTION] Adopting HA device: ${request.haDeviceId}`);

		// Validate HA device exists
		const devicesRegistry = await this.homeAssistantWsService.getDevicesRegistry();
		const haDevice = devicesRegistry.find((d) => d.id === request.haDeviceId);

		if (!haDevice) {
			throw new DevicesHomeAssistantNotFoundException(
				`Home Assistant device with ID ${request.haDeviceId} not found in registry`,
			);
		}

		// Check if device is already adopted
		const existingDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);
		const existingDevice = existingDevices.find((d) => d.haDeviceId === request.haDeviceId);

		if (existingDevice) {
			throw new DevicesHomeAssistantValidationException(
				`Home Assistant device ${request.haDeviceId} is already adopted as device ${existingDevice.id}`,
			);
		}

		// Create the device
		const createDeviceDto = toInstance(CreateHomeAssistantDeviceDto, {
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: request.category,
			name: request.name,
			ha_device_id: request.haDeviceId,
		});

		const errors = await validate(createDeviceDto);
		if (errors.length) {
			this.logger.error(`[DEVICE ADOPTION] Device validation failed: ${JSON.stringify(errors)}`);
			throw new DevicesHomeAssistantValidationException('Device validation failed');
		}

		// Create the device first (without channels - we'll add them separately)
		const device = await this.devicesService.create<HomeAssistantDeviceEntity, CreateHomeAssistantDeviceDto>(
			createDeviceDto,
		);

		this.logger.debug(`[DEVICE ADOPTION] Created device: ${device.id}`);

		try {
			// Create device information channel (auto-populated from HA registry)
			await this.createDeviceInformationChannel(device, haDevice);

			// Create user-defined channels from the adoption request
			for (const channelDef of request.channels) {
				await this.createChannel(device, channelDef);
			}

			// Return the fully loaded device
			return await this.devicesService.findOne<HomeAssistantDeviceEntity>(device.id, DEVICES_HOME_ASSISTANT_TYPE);
		} catch (error) {
			// If channel creation fails, we should clean up the device
			this.logger.error(`[DEVICE ADOPTION] Failed to create channels, cleaning up device: ${device.id}`, error);
			try {
				await this.devicesService.remove(device.id);
			} catch (cleanupError) {
				this.logger.error(`[DEVICE ADOPTION] Failed to cleanup device: ${device.id}`, cleanupError);
			}
			throw error;
		}
	}

	/**
	 * Create the device information channel with metadata from HA registry
	 */
	private async createDeviceInformationChannel(
		device: HomeAssistantDeviceEntity,
		haDevice: {
			manufacturer: string | null;
			model: string | null;
			serialNumber: string | null;
			swVersion: string | null;
			hwVersion: string | null;
			connections: [string, string][];
		},
	): Promise<void> {
		const connectionTypeRaw = haDevice.connections.length ? haDevice.connections[0][0] : null;
		const connectionType =
			connectionTypeRaw && connectionTypeRaw in this.CONNECTION_TYPE_MAP
				? this.CONNECTION_TYPE_MAP[connectionTypeRaw]
				: null;

		const haDeviceInformationProperties: Record<PropertyCategory, unknown> = {
			[PropertyCategory.MANUFACTURER]: haDevice.manufacturer,
			[PropertyCategory.MODEL]: haDevice.model,
			[PropertyCategory.SERIAL_NUMBER]: haDevice.serialNumber || 'N/A',
			[PropertyCategory.FIRMWARE_REVISION]: haDevice.swVersion,
			[PropertyCategory.HARDWARE_REVISION]: haDevice.hwVersion,
			[PropertyCategory.CONNECTION_TYPE]: connectionType,
			[PropertyCategory.STATUS]: ConnectionState.UNKNOWN,
		} as Record<PropertyCategory, unknown>;

		const rawSchema = channelsSchema[ChannelCategory.DEVICE_INFORMATION] as object | undefined;

		if (!rawSchema || typeof rawSchema !== 'object') {
			this.logger.warn(
				`[DEVICE ADOPTION] Missing or invalid schema for channel category ${ChannelCategory.DEVICE_INFORMATION}`,
			);
			return;
		}

		const categorySpec = toInstance(
			ChannelSpecModel,
			{
				...rawSchema,
				properties: 'properties' in rawSchema && rawSchema.properties ? Object.values(rawSchema.properties) : [],
			},
			{
				excludeExtraneousValues: false,
			},
		);

		const errors = await validate(categorySpec);

		if (errors.length) {
			this.logger.error(`[DEVICE ADOPTION] Channel spec validation failed: ${JSON.stringify(errors)}`);
			return;
		}

		const createChannelDto = toInstance(CreateHomeAssistantChannelDto, {
			device: device.id,
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: ChannelCategory.DEVICE_INFORMATION,
			name: 'Device information',
			properties: Object.entries(haDeviceInformationProperties)
				.filter(([, value]) => value != null)
				.map(([category, value]: [string, unknown]) => {
					const spec = categorySpec.properties.find((p) => p.category === (category as PropertyCategory));

					if (!spec) {
						return null;
					}

					// Convert value to string safely
					let stringValue: string;
					if (typeof value === 'object' && value !== null) {
						stringValue = JSON.stringify(value);
					} else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						stringValue = String(value);
					} else {
						stringValue = '';
					}

					return {
						type: DEVICES_HOME_ASSISTANT_TYPE,
						category: category as PropertyCategory,
						permissions: spec.permissions,
						data_type: spec.data_type,
						unit: spec.unit,
						format: spec.format,
						invalid: spec.invalid,
						step: spec.step,
						value: stringValue,
						ha_entity_id: null,
						ha_attribute: null,
					};
				})
				.filter((prop) => prop !== null),
		});

		await this.channelsService.create(createChannelDto);

		this.logger.debug(`[DEVICE ADOPTION] Created device information channel for device: ${device.id}`);
	}

	/**
	 * Create a channel from the adoption request
	 */
	private async createChannel(
		device: HomeAssistantDeviceEntity,
		channelDef: AdoptDeviceRequestDto['channels'][0],
	): Promise<void> {
		// Get channel spec for validation
		const rawSchema = channelsSchema[channelDef.category as keyof typeof channelsSchema] as object | undefined;

		if (!rawSchema || typeof rawSchema !== 'object') {
			this.logger.warn(`[DEVICE ADOPTION] Missing or invalid schema for channel category ${channelDef.category}`);
			// Continue anyway - the channel might still be valid
		}

		const properties = channelDef.properties.map((propDef) => ({
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: propDef.category,
			permissions: propDef.permissions,
			data_type: propDef.dataType,
			unit: propDef.unit ?? null,
			format: propDef.format ?? null,
			invalid: null,
			step: null,
			value: null,
			ha_entity_id: channelDef.entityId,
			ha_attribute: propDef.haAttribute,
		}));

		const createChannelDto = toInstance(CreateHomeAssistantChannelDto, {
			device: device.id,
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: channelDef.category,
			name: channelDef.name,
			properties,
		});

		const errors = await validate(createChannelDto, { skipMissingProperties: true });

		if (errors.length) {
			this.logger.error(
				`[DEVICE ADOPTION] Channel validation failed for ${channelDef.category}: ${JSON.stringify(errors)}`,
			);
			throw new DevicesHomeAssistantValidationException(`Channel validation failed for ${channelDef.category}`);
		}

		await this.channelsService.create(createChannelDto);

		this.logger.debug(`[DEVICE ADOPTION] Created channel ${channelDef.category} for device: ${device.id}`);
	}
}
