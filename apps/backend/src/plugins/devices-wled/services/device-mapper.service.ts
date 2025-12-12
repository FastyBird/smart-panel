import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_WLED_TYPE,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_DEFAULT_MANUFACTURER,
	WLED_DEFAULT_MODEL,
	WLED_DEVICE_DESCRIPTOR,
	WledPropertyBinding,
} from '../devices-wled.constants';
import { CreateWledChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateWledChannelDto } from '../dto/create-channel.dto';
import { CreateWledDeviceDto } from '../dto/create-device.dto';
import { UpdateWledChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateWledDeviceDto } from '../dto/update-device.dto';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from '../entities/devices-wled.entity';
import { WledDeviceContext, WledInfo, WledState } from '../interfaces/wled.interface';

/**
 * WLED Device Mapper Service
 *
 * Maps WLED device state and info to the internal device/channel/property model.
 */
@Injectable()
export class WledDeviceMapperService {
	private readonly logger = new Logger(WledDeviceMapperService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	/**
	 * Map and create or update a WLED device from its context
	 */
	async mapDevice(
		host: string,
		context: WledDeviceContext,
		configName?: string | null,
		configIdentifier?: string | null,
	): Promise<WledDeviceEntity> {
		// Generate identifier from MAC address if not provided
		const identifier = configIdentifier || this.generateIdentifier(context.info.mac);
		const name = configName || context.info.name || `WLED ${identifier}`;

		this.logger.debug(`[WLED][MAPPER] Mapping device: ${identifier} (${host})`);

		// Create or update the device entity
		let device = await this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE);

		if (!device) {
			this.logger.log(`[WLED][MAPPER] Creating new device: ${identifier} with name: ${name}`);

			const createDto: CreateWledDeviceDto = {
				type: DEVICES_WLED_TYPE,
				identifier,
				name,
				category: DeviceCategory.LIGHTING,
				enabled: true,
				hostname: host,
			};

			device = await this.devicesService.create<WledDeviceEntity, CreateWledDeviceDto>(createDto);
		} else {
			// Device exists - check if enabled
			if (!device.enabled) {
				this.logger.debug(`[WLED][MAPPER] Device ${identifier} is disabled, setting to UNKNOWN and skipping updates`);

				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});

				return device;
			}

			this.logger.debug(`[WLED][MAPPER] Device already exists: ${identifier}, updating hostname if changed`);

			// Update hostname if it changed
			if (device.hostname !== host) {
				this.logger.log(`[WLED][MAPPER] Updating hostname for device ${identifier}: ${device.hostname} -> ${host}`);

				const updateDto: UpdateWledDeviceDto = {
					type: DEVICES_WLED_TYPE,
					hostname: host,
				};

				device = await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(device.id, updateDto);
			}
		}

		// Create channels and properties
		await this.createDeviceInformationChannel(device, context.info);
		await this.createLightChannel(device, context.state);

		// Set connection state to CONNECTED
		await this.deviceConnectivityService.setConnectionState(device.id, {
			state: ConnectionState.CONNECTED,
		});

		return device;
	}

	/**
	 * Update device state from WLED state
	 */
	async updateDeviceState(identifier: string, state: WledState): Promise<void> {
		const device = await this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE);

		if (!device) {
			this.logger.warn(`[WLED][MAPPER] Device not found for state update: ${identifier}`);
			return;
		}

		if (!device.enabled) {
			this.logger.debug(`[WLED][MAPPER] Device ${identifier} is disabled, skipping state update`);
			return;
		}

		// Find light channel
		const lightChannel = await this.channelsService.findOneBy<WledChannelEntity>(
			'identifier',
			WLED_CHANNEL_IDENTIFIERS.LIGHT,
			device.id,
			DEVICES_WLED_TYPE,
		);

		if (!lightChannel) {
			this.logger.warn(`[WLED][MAPPER] Light channel not found for device ${identifier}`);
			return;
		}

		// Update light properties
		const propertyUpdates = this.extractStateProperties(state);

		for (const [propertyIdentifier, value] of Object.entries(propertyUpdates)) {
			const property = await this.channelsPropertiesService.findOneBy<WledChannelPropertyEntity>(
				'identifier',
				propertyIdentifier,
				lightChannel.id,
				DEVICES_WLED_TYPE,
			);

			if (property) {
				await this.channelsPropertiesService.update<WledChannelPropertyEntity, UpdateWledChannelPropertyDto>(
					property.id,
					toInstance(UpdateWledChannelPropertyDto, {
						type: DEVICES_WLED_TYPE,
						value,
					}),
				);
			}
		}
	}

	/**
	 * Set device connection state
	 */
	async setDeviceConnectionState(identifier: string, state: ConnectionState): Promise<void> {
		const device = await this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE);

		if (device) {
			await this.deviceConnectivityService.setConnectionState(device.id, { state });
		}
	}

	/**
	 * Generate a device identifier from MAC address
	 */
	private generateIdentifier(mac: string): string {
		// Remove colons and convert to lowercase
		const cleanMac = mac.replace(/:/g, '').toLowerCase();
		return `wled-${cleanMac.slice(-6)}`; // Use last 6 chars of MAC
	}

	/**
	 * Create the device_information channel with device metadata
	 */
	private async createDeviceInformationChannel(device: WledDeviceEntity, info: WledInfo): Promise<void> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;
		const channelDescriptor = WLED_DEVICE_DESCRIPTOR.channels.find((c) => c.identifier === channelIdentifier);

		if (!channelDescriptor) {
			return;
		}

		// Find or create channel
		let channel = await this.channelsService.findOneBy<WledChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_WLED_TYPE,
		);

		if (!channel) {
			this.logger.debug(`[WLED][MAPPER] Creating device_information channel for device ${device.identifier}`);

			const createChannelDto: CreateWledChannelDto = {
				type: DEVICES_WLED_TYPE,
				identifier: channelIdentifier,
				name: channelDescriptor.name,
				category: channelDescriptor.category,
				device: device.id,
			};

			channel = await this.channelsService.create<WledChannelEntity, CreateWledChannelDto>(createChannelDto);
		}

		// Create/update properties with device info
		const propertyValues: Record<string, string | number> = {
			manufacturer: info.brand || WLED_DEFAULT_MANUFACTURER,
			model: info.product || WLED_DEFAULT_MODEL,
			serial_number: info.mac,
			firmware_version: info.version,
			hardware_version: info.architecture,
			mac_address: info.mac,
			led_count: info.ledInfo.count,
			ip_address: info.ip,
		};

		for (const binding of channelDescriptor.bindings) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}
	}

	/**
	 * Create the light channel with control properties
	 */
	private async createLightChannel(device: WledDeviceEntity, state: WledState): Promise<void> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.LIGHT;
		const channelDescriptor = WLED_DEVICE_DESCRIPTOR.channels.find((c) => c.identifier === channelIdentifier);

		if (!channelDescriptor) {
			return;
		}

		// Find or create channel
		let channel = await this.channelsService.findOneBy<WledChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_WLED_TYPE,
		);

		if (!channel) {
			this.logger.debug(`[WLED][MAPPER] Creating light channel for device ${device.identifier}`);

			const createChannelDto: CreateWledChannelDto = {
				type: DEVICES_WLED_TYPE,
				identifier: channelIdentifier,
				name: channelDescriptor.name,
				category: channelDescriptor.category,
				device: device.id,
			};

			channel = await this.channelsService.create<WledChannelEntity, CreateWledChannelDto>(createChannelDto);
		}

		// Extract state values
		const propertyValues = this.extractStateProperties(state);

		// Create/update properties
		for (const binding of channelDescriptor.bindings) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}
	}

	/**
	 * Extract property values from WLED state
	 */
	private extractStateProperties(state: WledState): Record<string, string | number | boolean> {
		const segment = state.segments[0]; // Primary segment

		return {
			state: state.on,
			brightness: state.brightness,
			color_red: segment?.colors?.[0]?.[0] ?? 0,
			color_green: segment?.colors?.[0]?.[1] ?? 0,
			color_blue: segment?.colors?.[0]?.[2] ?? 0,
			effect: segment?.effect ?? 0,
			effect_speed: segment?.effectSpeed ?? 128,
			effect_intensity: segment?.effectIntensity ?? 128,
		};
	}

	/**
	 * Create or update a channel property
	 */
	private async createOrUpdateProperty(
		channel: WledChannelEntity,
		binding: WledPropertyBinding,
		value?: string | number | boolean,
	): Promise<void> {
		let property = await this.channelsPropertiesService.findOneBy<WledChannelPropertyEntity>(
			'identifier',
			binding.propertyIdentifier,
			channel.id,
			DEVICES_WLED_TYPE,
		);

		if (!property) {
			this.logger.debug(
				`[WLED][MAPPER] Creating property ${binding.propertyIdentifier} for channel ${channel.identifier}`,
			);

			const format = binding.min !== undefined && binding.max !== undefined ? [binding.min, binding.max] : null;

			const createPropertyDto: CreateWledChannelPropertyDto = {
				type: DEVICES_WLED_TYPE,
				identifier: binding.propertyIdentifier,
				name: binding.name,
				category: binding.category,
				data_type: binding.dataType,
				permissions: binding.permissions,
				unit: binding.unit ?? null,
				format,
				step: binding.step ?? null,
			};

			property = await this.channelsPropertiesService.create<WledChannelPropertyEntity, CreateWledChannelPropertyDto>(
				channel.id,
				createPropertyDto,
			);
		}

		// Update value if provided
		if (value !== undefined) {
			await this.channelsPropertiesService.update<WledChannelPropertyEntity, UpdateWledChannelPropertyDto>(
				property.id,
				toInstance(UpdateWledChannelPropertyDto, {
					type: DEVICES_WLED_TYPE,
					value,
				}),
			);
		}
	}
}
