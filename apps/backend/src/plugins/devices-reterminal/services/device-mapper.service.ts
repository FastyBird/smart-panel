import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_DEVICE_DESCRIPTOR,
	RETERMINAL_DM_DEVICE_DESCRIPTOR,
	RETERMINAL_MANUFACTURER,
	RETERMINAL_SYSFS,
	type ReTerminalDeviceDescriptor,
	type ReTerminalPropertyBinding,
	ReTerminalVariant,
} from '../devices-reterminal.constants';
import { CreateReTerminalChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateReTerminalChannelDto } from '../dto/create-channel.dto';
import { CreateReTerminalDeviceDto } from '../dto/create-device.dto';
import { UpdateReTerminalChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	ReTerminalChannelEntity,
	ReTerminalChannelPropertyEntity,
	ReTerminalDeviceEntity,
} from '../entities/devices-reterminal.entity';

import { ReTerminalSysfsService } from './reterminal-sysfs.service';

@Injectable()
export class ReTerminalDeviceMapperService {
	private readonly logger = new Logger(ReTerminalDeviceMapperService.name);

	private cachedLightDevicePath: string | null | undefined = undefined;
	private cachedAccelDevicePath: string | null | undefined = undefined;

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly provisionQueue: DeviceProvisionQueueService,
		private readonly sysfsService: ReTerminalSysfsService,
	) {}

	/**
	 * Create or update the reTerminal device with all its channels and properties.
	 */
	async mapDevice(variant: ReTerminalVariant): Promise<ReTerminalDeviceEntity> {
		const identifier = `reterminal_${variant}`;

		return this.provisionQueue.enqueue(identifier, () => this.doMapDevice(variant, identifier));
	}

	private async doMapDevice(variant: ReTerminalVariant, identifier: string): Promise<ReTerminalDeviceEntity> {
		const descriptor = this.getDescriptor(variant);

		this.logger.log(`Mapping reTerminal device: ${descriptor.name} (${identifier})`);

		// Find or create device
		let device = await this.devicesService.findOneBy<ReTerminalDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_RETERMINAL_TYPE,
		);

		if (!device) {
			const createDto: CreateReTerminalDeviceDto = {
				type: DEVICES_RETERMINAL_TYPE,
				identifier,
				name: descriptor.name,
				category: DeviceCategory.TERMINAL,
				enabled: true,
				variant,
			};

			device = await this.devicesService.create<ReTerminalDeviceEntity, CreateReTerminalDeviceDto>(createDto);

			this.logger.log(`Created reTerminal device: ${device.id}`);
		}

		// Create channels and properties from descriptor
		for (const channelDef of descriptor.channels) {
			let channel = await this.channelsService.findOneBy<ReTerminalChannelEntity>(
				'identifier',
				channelDef.identifier,
				device.id,
				DEVICES_RETERMINAL_TYPE,
			);

			if (!channel) {
				const createChannelDto: CreateReTerminalChannelDto = {
					type: DEVICES_RETERMINAL_TYPE,
					identifier: channelDef.identifier,
					name: channelDef.name,
					category: channelDef.category,
					device: device.id,
				};

				channel = await this.channelsService.create<ReTerminalChannelEntity, CreateReTerminalChannelDto>(
					createChannelDto,
				);

				this.logger.debug(`Created channel: ${channelDef.identifier}`);
			}

			// Create properties for this channel
			for (const binding of channelDef.bindings) {
				await this.ensureProperty(channel, binding);
			}
		}

		// Set device info properties
		await this.updateDeviceInfo(device, descriptor);

		// Set device as connected
		await this.deviceConnectivityService.setConnectionState(device.id, {
			state: ConnectionState.READY,
		});

		return device;
	}

	/**
	 * Update sensor values on the device properties.
	 */
	async updateSensorValues(deviceId: string, variant: ReTerminalVariant): Promise<void> {
		// Read CPU temperature (available on all variants)
		const temperature = await this.sysfsService.readCpuTemperature();

		if (temperature !== null) {
			await this.setPropertyValue(deviceId, 'temperature', 'temperature', temperature);
		}

		// Light sensor and accelerometer are only available on reTerminal CM4
		if (variant === ReTerminalVariant.RETERMINAL) {
			// Read light sensor (if available) - cache the IIO device path since it never changes at runtime
			if (this.cachedLightDevicePath === undefined) {
				this.cachedLightDevicePath = await this.sysfsService.findIioDevice('ltr303');
			}

			if (this.cachedLightDevicePath) {
				const luxRaw = await this.sysfsService.readIioAttribute(this.cachedLightDevicePath, 'in_illuminance_raw');

				if (luxRaw) {
					const scaleRaw = await this.sysfsService.readIioAttribute(this.cachedLightDevicePath, 'in_illuminance_scale');
					const scale = scaleRaw ? parseFloat(scaleRaw) : 1;

					await this.setPropertyValue(deviceId, 'light_sensor', 'illuminance', parseFloat(luxRaw) * scale);
				}
			}

			// Read accelerometer (if available) - cache the IIO device path since it never changes at runtime
			if (this.cachedAccelDevicePath === undefined) {
				this.cachedAccelDevicePath = await this.sysfsService.findIioDevice('lis3dh');
			}

			if (this.cachedAccelDevicePath) {
				const scaleRaw = await this.sysfsService.readIioAttribute(this.cachedAccelDevicePath, 'in_accel_scale');
				const scale = scaleRaw ? parseFloat(scaleRaw) : 1;

				// IIO accel raw * scale yields m/s²; convert to g-force (1 g = 9.80665 m/s²)
				const STANDARD_GRAVITY = 9.80665;

				const xRaw = await this.sysfsService.readIioAttribute(this.cachedAccelDevicePath, 'in_accel_x_raw');
				const yRaw = await this.sysfsService.readIioAttribute(this.cachedAccelDevicePath, 'in_accel_y_raw');
				const zRaw = await this.sysfsService.readIioAttribute(this.cachedAccelDevicePath, 'in_accel_z_raw');

				if (xRaw)
					await this.setPropertyValue(
						deviceId,
						'accelerometer',
						'acceleration_x',
						(parseFloat(xRaw) * scale) / STANDARD_GRAVITY,
					);
				if (yRaw)
					await this.setPropertyValue(
						deviceId,
						'accelerometer',
						'acceleration_y',
						(parseFloat(yRaw) * scale) / STANDARD_GRAVITY,
					);
				if (zRaw)
					await this.setPropertyValue(
						deviceId,
						'accelerometer',
						'acceleration_z',
						(parseFloat(zRaw) * scale) / STANDARD_GRAVITY,
					);

				// Compute orientation from acceleration values (in g)
				if (xRaw && yRaw && zRaw) {
					const x = (parseFloat(xRaw) * scale) / STANDARD_GRAVITY;
					const y = (parseFloat(yRaw) * scale) / STANDARD_GRAVITY;
					const z = (parseFloat(zRaw) * scale) / STANDARD_GRAVITY;
					const orientation = this.computeOrientation(x, y, z);

					await this.setPropertyValue(deviceId, 'accelerometer', 'orientation', orientation);
				}
			}
		}

		// Read LED states
		await this.updateLedStates(deviceId, variant);
	}

	private async updateLedStates(deviceId: string, variant: ReTerminalVariant): Promise<void> {
		// USR LED is only available on reTerminal CM4
		if (variant === ReTerminalVariant.RETERMINAL) {
			const usrBrightness = await this.sysfsService.readLedBrightness(RETERMINAL_SYSFS.USR_LED);

			if (usrBrightness !== null) {
				await this.setPropertyValue(deviceId, 'usr_led', 'on', usrBrightness > 0);
				await this.setPropertyValue(deviceId, 'usr_led', 'brightness', usrBrightness);
			}
		}

		if (variant === ReTerminalVariant.RETERMINAL) {
			// CM4 variant has separate green/red LED channels with brightness and color
			const staGreen = await this.sysfsService.readLedBrightness(RETERMINAL_SYSFS.STA_LED_GREEN);
			const staRed = await this.sysfsService.readLedBrightness(RETERMINAL_SYSFS.STA_LED_RED);

			if (staGreen !== null && staRed !== null) {
				const isOn = staGreen > 0 || staRed > 0;

				await this.setPropertyValue(deviceId, 'sta_led', 'on', isOn);
				await this.setPropertyValue(deviceId, 'sta_led', 'brightness', Math.max(staGreen, staRed));

				if (staRed > 0 && staGreen === 0) {
					await this.setPropertyValue(deviceId, 'sta_led', 'color', 'red');
				} else if (staGreen > 0 && staRed === 0) {
					await this.setPropertyValue(deviceId, 'sta_led', 'color', 'green');
				} else if (!isOn) {
					await this.setPropertyValue(deviceId, 'sta_led', 'color', 'off');
				}
			}
		} else {
			// DM variant only has an 'on' property for the STA LED
			const staGreen = await this.sysfsService.readLedBrightness(RETERMINAL_SYSFS.STA_LED_GREEN);

			if (staGreen !== null) {
				await this.setPropertyValue(deviceId, 'sta_led', 'on', staGreen > 0);
			}
		}
	}

	private async updateDeviceInfo(
		device: ReTerminalDeviceEntity,
		descriptor: ReTerminalDeviceDescriptor,
	): Promise<void> {
		const serialNumber = await this.sysfsService.getSerialNumber();
		const firmwareVersion = await this.sysfsService.getFirmwareVersion();

		await this.setPropertyValue(device.id, 'device_information', 'manufacturer', RETERMINAL_MANUFACTURER);
		await this.setPropertyValue(device.id, 'device_information', 'model', descriptor.name);
		await this.setPropertyValue(device.id, 'device_information', 'serial_number', serialNumber);
		await this.setPropertyValue(device.id, 'device_information', 'firmware_revision', firmwareVersion);
		await this.setPropertyValue(device.id, 'device_information', 'hardware_revision', descriptor.variant);
	}

	private async ensureProperty(channel: ReTerminalChannelEntity, binding: ReTerminalPropertyBinding): Promise<void> {
		const existing = await this.channelsPropertiesService.findOneBy<ReTerminalChannelPropertyEntity>(
			'identifier',
			binding.propertyIdentifier,
			channel.id,
			DEVICES_RETERMINAL_TYPE,
		);

		if (existing) return;

		const format = binding.format
			? Array.isArray(binding.format)
				? binding.format
				: [binding.format]
			: binding.min !== undefined && binding.max !== undefined
				? [binding.min, binding.max]
				: null;

		const createPropertyDto: CreateReTerminalChannelPropertyDto = {
			type: DEVICES_RETERMINAL_TYPE,
			identifier: binding.propertyIdentifier,
			name: binding.name,
			category: binding.category,
			data_type: binding.dataType,
			permissions: binding.permissions,
			format,
			step: binding.step ?? null,
		};

		await this.channelsPropertiesService.create<ReTerminalChannelPropertyEntity, CreateReTerminalChannelPropertyDto>(
			channel.id,
			createPropertyDto,
		);
	}

	private async setPropertyValue(
		deviceId: string,
		channelIdentifier: string,
		propertyIdentifier: string,
		value: string | number | boolean,
	): Promise<void> {
		try {
			const channel = await this.channelsService.findOneBy<ReTerminalChannelEntity>(
				'identifier',
				channelIdentifier,
				deviceId,
				DEVICES_RETERMINAL_TYPE,
			);

			if (!channel) return;

			const property = await this.channelsPropertiesService.findOneBy<ReTerminalChannelPropertyEntity>(
				'identifier',
				propertyIdentifier,
				channel.id,
				DEVICES_RETERMINAL_TYPE,
			);

			if (!property) return;

			await this.channelsPropertiesService.update<ReTerminalChannelPropertyEntity, UpdateReTerminalChannelPropertyDto>(
				property.id,
				toInstance(UpdateReTerminalChannelPropertyDto, {
					type: DEVICES_RETERMINAL_TYPE,
					value,
				}),
			);
		} catch (error) {
			this.logger.debug(`Failed to set property value ${channelIdentifier}.${propertyIdentifier}: ${error}`);
		}
	}

	private computeOrientation(x: number, y: number, z: number): string {
		const absX = Math.abs(x);
		const absY = Math.abs(y);
		const absZ = Math.abs(z);

		if (absZ > absX && absZ > absY) {
			return z > 0 ? 'face_up' : 'face_down';
		}

		if (absX > absY) {
			return x > 0 ? 'landscape' : 'landscape_inverted';
		}

		return y > 0 ? 'portrait' : 'portrait_inverted';
	}

	private getDescriptor(variant: ReTerminalVariant): ReTerminalDeviceDescriptor {
		return variant === ReTerminalVariant.RETERMINAL_DM ? RETERMINAL_DM_DEVICE_DESCRIPTOR : RETERMINAL_DEVICE_DESCRIPTOR;
	}
}
