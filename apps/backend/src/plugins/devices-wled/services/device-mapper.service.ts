import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_WLED_PLUGIN_NAME,
	DEVICES_WLED_TYPE,
	ELECTRICAL_POWER_BINDINGS,
	NIGHTLIGHT_BINDINGS,
	SYNC_BINDINGS,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_DEFAULT_MANUFACTURER,
	WLED_DEFAULT_MODEL,
	WLED_DEVICE_DESCRIPTOR,
	WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS,
	WLED_LIGHT_PROPERTY_IDENTIFIERS,
	WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS,
	WLED_SEGMENT_PROPERTY_IDENTIFIERS,
	WLED_SYNC_PROPERTY_IDENTIFIERS,
	WledPropertyBinding,
	createSegmentBindings,
	wledBrightnessToSpec,
	wledCurrentToAmps,
	wledPowerToWatts,
} from '../devices-wled.constants';
import { CreateWledChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateWledChannelDto } from '../dto/create-channel.dto';
import { CreateWledDeviceDto } from '../dto/create-device.dto';
import { UpdateWledChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateWledChannelDto } from '../dto/update-channel.dto';
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
	private readonly logger: ExtensionLoggerService = createExtensionLogger(DEVICES_WLED_PLUGIN_NAME, 'DeviceMapper');

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

		// Create or update the device entity
		let device = await this.devicesService.findOneBy<WledDeviceEntity>('identifier', identifier, DEVICES_WLED_TYPE);

		if (!device) {
			this.logger.log(`Creating new device: ${identifier} with name: ${name}`);

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
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});

				return device;
			}

			// Update hostname if it changed
			if (device.hostname !== host) {
				this.logger.log(`Updating hostname for device ${identifier}: ${device.hostname} -> ${host}`, {
					resource: device.id,
				});

				const updateDto: UpdateWledDeviceDto = {
					type: DEVICES_WLED_TYPE,
					hostname: host,
				};

				device = await this.devicesService.update<WledDeviceEntity, UpdateWledDeviceDto>(device.id, updateDto);
			}
		}

		// Create channels and properties
		await this.createDeviceInformationChannel(device, context.info);
		const lightChannel = await this.createLightChannel(device, context.state);
		await this.createElectricalPowerChannel(device, context.info, lightChannel?.id);
		await this.createNightlightChannel(device, context.state);
		await this.createSyncChannel(device, context.state);
		await this.createSegmentChannels(device, context.state, lightChannel?.id);

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
			this.logger.warn(`Device not found for state update: ${identifier}`);
			return;
		}

		if (!device.enabled) {
			return;
		}

		// Update light channel
		await this.updateChannelProperties(
			device.id,
			WLED_CHANNEL_IDENTIFIERS.LIGHT,
			this.extractLightStateProperties(state),
		);

		// Update nightlight channel
		await this.updateChannelProperties(
			device.id,
			WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
			this.extractNightlightStateProperties(state),
		);

		// Update sync channel
		await this.updateChannelProperties(
			device.id,
			WLED_CHANNEL_IDENTIFIERS.SYNC,
			this.extractSyncStateProperties(state),
		);

		// Update segment channels
		for (let i = 0; i < state.segments.length; i++) {
			const channelIdentifier = `${WLED_CHANNEL_IDENTIFIERS.SEGMENT}_${i}`;
			await this.updateChannelProperties(device.id, channelIdentifier, this.extractSegmentStateProperties(state, i));
		}
	}

	/**
	 * Update properties for a specific channel
	 */
	private async updateChannelProperties(
		deviceId: string,
		channelIdentifier: string,
		propertyUpdates: Record<string, string | number | boolean>,
	): Promise<void> {
		const channel = await this.channelsService.findOneBy<WledChannelEntity>(
			'identifier',
			channelIdentifier,
			deviceId,
			DEVICES_WLED_TYPE,
		);

		if (!channel) {
			return;
		}

		for (const [propertyIdentifier, value] of Object.entries(propertyUpdates)) {
			const property = await this.channelsPropertiesService.findOneBy<WledChannelPropertyEntity>(
				'identifier',
				propertyIdentifier,
				channel.id,
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
			firmware_revision: info.version,
			hardware_revision: info.architecture,
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
	private async createLightChannel(device: WledDeviceEntity, state: WledState): Promise<WledChannelEntity | null> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.LIGHT;
		const channelDescriptor = WLED_DEVICE_DESCRIPTOR.channels.find((c) => c.identifier === channelIdentifier);

		if (!channelDescriptor) {
			return null;
		}

		// Find or create channel
		let channel = await this.channelsService.findOneBy<WledChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_WLED_TYPE,
		);

		if (!channel) {
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
		const propertyValues = this.extractLightStateProperties(state);

		// Create/update properties
		for (const binding of channelDescriptor.bindings) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}

		return channel;
	}

	/**
	 * Create the nightlight channel with control properties
	 */
	private async createNightlightChannel(device: WledDeviceEntity, state: WledState): Promise<void> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT;
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
		const propertyValues = this.extractNightlightStateProperties(state);

		// Create/update properties
		for (const binding of NIGHTLIGHT_BINDINGS) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}
	}

	/**
	 * Create the sync channel with control properties
	 */
	private async createSyncChannel(device: WledDeviceEntity, state: WledState): Promise<void> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.SYNC;
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
		const propertyValues = this.extractSyncStateProperties(state);

		// Create/update properties
		for (const binding of SYNC_BINDINGS) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}
	}

	/**
	 * Create the electrical_power channel with power monitoring properties
	 * WLED provides estimated power consumption via ledInfo.power (in mA)
	 */
	private async createElectricalPowerChannel(
		device: WledDeviceEntity,
		info: WledInfo,
		parent?: string | null,
	): Promise<void> {
		const channelIdentifier = WLED_CHANNEL_IDENTIFIERS.ELECTRICAL_POWER;
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
			const createChannelDto: CreateWledChannelDto = {
				type: DEVICES_WLED_TYPE,
				identifier: channelIdentifier,
				name: channelDescriptor.name,
				category: channelDescriptor.category,
				device: device.id,
				parent: parent ?? null,
			};

			channel = await this.channelsService.create<WledChannelEntity, CreateWledChannelDto>(createChannelDto);
		} else {
			// Update existing channel with parent if needed
			channel = await this.channelsService.update<WledChannelEntity, UpdateWledChannelDto>(channel.id, {
				type: DEVICES_WLED_TYPE,
				parent: parent ?? null,
			});
		}

		// Extract power values (convert from mA to W and A)
		const propertyValues = this.extractElectricalPowerProperties(info);

		// Create/update properties
		for (const binding of ELECTRICAL_POWER_BINDINGS) {
			await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
		}
	}

	/**
	 * Create segment channels based on the number of segments in the device
	 */
	private async createSegmentChannels(
		device: WledDeviceEntity,
		state: WledState,
		parent?: string | null,
	): Promise<void> {
		for (let i = 0; i < state.segments.length; i++) {
			const channelIdentifier = `${WLED_CHANNEL_IDENTIFIERS.SEGMENT}_${i}`;

			// Find or create channel
			let channel = await this.channelsService.findOneBy<WledChannelEntity>(
				'identifier',
				channelIdentifier,
				device.id,
				DEVICES_WLED_TYPE,
			);

			if (!channel) {
				const createChannelDto: CreateWledChannelDto = {
					type: DEVICES_WLED_TYPE,
					identifier: channelIdentifier,
					name: `Segment ${i}`,
					category: ChannelCategory.LIGHT,
					device: device.id,
					parent: parent ?? null,
				};

				channel = await this.channelsService.create<WledChannelEntity, CreateWledChannelDto>(createChannelDto);
			} else {
				// Update existing channel with parent if needed
				channel = await this.channelsService.update<WledChannelEntity, UpdateWledChannelDto>(channel.id, {
					type: DEVICES_WLED_TYPE,
					parent: parent ?? null,
				});
			}

			// Extract state values for this segment
			const propertyValues = this.extractSegmentStateProperties(state, i);
			const segmentBindings = createSegmentBindings(i);

			// Create/update properties
			for (const binding of segmentBindings) {
				await this.createOrUpdateProperty(channel, binding, propertyValues[binding.propertyIdentifier]);
			}
		}
	}

	/**
	 * Extract light property values from WLED state (with spec-compliant conversion)
	 * - 'on' instead of 'state'
	 * - brightness converted from 0-255 to 0-100%
	 */
	private extractLightStateProperties(state: WledState): Record<string, string | number | boolean> {
		const segment = state.segments[0]; // Primary segment

		return {
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.ON]: state.on,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.BRIGHTNESS]: wledBrightnessToSpec(state.brightness),
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_RED]: segment?.colors?.[0]?.[0] ?? 0,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_GREEN]: segment?.colors?.[0]?.[1] ?? 0,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_BLUE]: segment?.colors?.[0]?.[2] ?? 0,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT]: segment?.effect ?? 0,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_SPEED]: segment?.effectSpeed ?? 128,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY]: segment?.effectIntensity ?? 128,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.PALETTE]: segment?.palette ?? 0,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.PRESET]: state.preset ?? -1,
			[WLED_LIGHT_PROPERTY_IDENTIFIERS.LIVE_OVERRIDE]: state.liveOverride ?? 0,
		};
	}

	/**
	 * Extract nightlight property values from WLED state (with spec-compliant conversion)
	 * - 'on' instead of 'state'
	 * - target_brightness converted from 0-255 to 0-100%
	 */
	private extractNightlightStateProperties(state: WledState): Record<string, string | number | boolean> {
		const nl = state.nightlight;

		return {
			[WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.ON]: nl?.on ?? false,
			[WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.DURATION]: nl?.duration ?? 60,
			[WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.MODE]: nl?.mode ?? 0,
			[WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.TARGET_BRIGHTNESS]: wledBrightnessToSpec(nl?.targetBrightness ?? 0),
			[WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.REMAINING]: nl?.remaining ?? -1,
		};
	}

	/**
	 * Extract sync property values from WLED state
	 */
	private extractSyncStateProperties(state: WledState): Record<string, string | number | boolean> {
		const udp = state.udp;

		return {
			[WLED_SYNC_PROPERTY_IDENTIFIERS.SEND]: udp?.send ?? false,
			[WLED_SYNC_PROPERTY_IDENTIFIERS.RECEIVE]: udp?.receive ?? false,
		};
	}

	/**
	 * Extract electrical power property values from WLED info (with spec-compliant conversion)
	 * - power converted from mA to W (using 5V default)
	 * - current converted from mA to A
	 */
	private extractElectricalPowerProperties(info: WledInfo): Record<string, string | number | boolean> {
		const powerMa = info.ledInfo?.power ?? 0;

		return {
			[WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS.POWER]: wledPowerToWatts(powerMa),
			[WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS.CURRENT]: wledCurrentToAmps(powerMa),
		};
	}

	/**
	 * Extract segment property values from WLED state (with spec-compliant conversion)
	 * - 'on' instead of 'state'
	 * - brightness converted from 0-255 to 0-100%
	 */
	private extractSegmentStateProperties(
		state: WledState,
		segmentId: number,
	): Record<string, string | number | boolean> {
		const segment = state.segments[segmentId];

		if (!segment) {
			return {};
		}

		return {
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.ON]: segment.on ?? true,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.BRIGHTNESS]: wledBrightnessToSpec(segment.brightness ?? 255),
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_RED]: segment.colors?.[0]?.[0] ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_GREEN]: segment.colors?.[0]?.[1] ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_BLUE]: segment.colors?.[0]?.[2] ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT]: segment.effect ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_SPEED]: segment.effectSpeed ?? 128,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY]: segment.effectIntensity ?? 128,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.PALETTE]: segment.palette ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.START]: segment.start ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.STOP]: segment.stop ?? 0,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.REVERSE]: segment.reverse ?? false,
			[WLED_SEGMENT_PROPERTY_IDENTIFIERS.MIRROR]: segment.mirror ?? false,
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
			const format = binding.min !== undefined && binding.max !== undefined ? [binding.min, binding.max] : null;

			const createPropertyDto: CreateWledChannelPropertyDto = {
				type: DEVICES_WLED_TYPE,
				identifier: binding.propertyIdentifier,
				name: binding.name,
				category: binding.category,
				data_type: binding.dataType,
				permissions: binding.permissions,
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
