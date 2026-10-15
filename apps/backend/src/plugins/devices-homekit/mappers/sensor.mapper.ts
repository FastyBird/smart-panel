import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';
import { communicationFailure, validateHapNumber } from './property-read';
import { bindUnavailableCharacteristic } from './unavailable-characteristic';

const SENSOR_CHANNEL_CATEGORIES = [
	ChannelCategory.CARBON_DIOXIDE,
	ChannelCategory.TEMPERATURE,
	ChannelCategory.HUMIDITY,
	ChannelCategory.MOTION,
	ChannelCategory.CONTACT,
	ChannelCategory.OCCUPANCY,
	ChannelCategory.ILLUMINANCE,
	ChannelCategory.LEAK,
	ChannelCategory.SMOKE,
];

export class SensorMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		return (
			this.findChannels(device, ChannelCategory.CARBON_DIOXIDE).some(
				(channel) => !!this.findCarbonDioxideLevel(channel, PropertyCategory.CONCENTRATION),
			) ||
			this.hasValidSensorChannel(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.DETECTED) ||
			this.hasValidSensorChannel(device, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE) ||
			this.hasValidSensorChannel(device, ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY) ||
			this.hasValidSensorChannel(device, ChannelCategory.MOTION, PropertyCategory.DETECTED) ||
			this.hasValidSensorChannel(device, ChannelCategory.CONTACT, PropertyCategory.DETECTED) ||
			this.hasValidSensorChannel(device, ChannelCategory.OCCUPANCY, PropertyCategory.DETECTED) ||
			this.hasValidSensorChannel(device, ChannelCategory.ILLUMINANCE, PropertyCategory.ILLUMINANCE) ||
			this.hasValidSensorChannel(device, ChannelCategory.LEAK, PropertyCategory.DETECTED) ||
			this.hasValidSensorChannel(device, ChannelCategory.SMOKE, PropertyCategory.DETECTED)
		);
	}

	private hasValidSensorChannel(
		device: DeviceEntity,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
	): boolean {
		const channels = this.findChannels(device, channelCategory);
		return channels.some((ch) => !!this.findProperty(ch, propertyCategory));
	}

	getSuggestedServiceType(device: DeviceEntity): string {
		for (const category of SENSOR_CHANNEL_CATEGORIES) {
			if (this.findChannel(device, category)) {
				return `sensor_${category}`;
			}
		}
		return 'sensor';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const accessory = this.createBaseAccessory(device, Categories.SENSOR);
		return this.addSensorServices(accessory, device, context) ? accessory : null;
	}

	static attachSensorServices(accessory: Accessory, device: DeviceEntity, context: HomeKitMapperContext): void {
		new SensorMapper().addSensorServices(accessory, device, context);
	}

	private findCarbonDioxideLevel(
		channel: ChannelEntity,
		category: PropertyCategory,
	): ChannelPropertyEntity | undefined {
		const property = this.findProperty(channel, category);
		return property?.dataType === DataTypeType.FLOAT && property.unit === 'ppm' ? property : undefined;
	}

	private addSensorServices(accessory: Accessory, device: DeviceEntity, context: HomeKitMapperContext): boolean {
		let addedService = false;

		for (const channel of this.findChannels(device, ChannelCategory.CARBON_DIOXIDE)) {
			const concentration = this.findCarbonDioxideLevel(channel, PropertyCategory.CONCENTRATION);
			const detected = this.findProperty(channel, PropertyCategory.DETECTED);
			if (!concentration && !detected) continue;
			const service = accessory.addService(Service.CarbonDioxideSensor, `${device.name} CO2`, channel.id);
			const fault = service.getCharacteristic(Characteristic.StatusFault);
			const detection = service.getCharacteristic(Characteristic.CarbonDioxideDetected);
			if (detected) {
				this.bindCharacteristic(
					context,
					device,
					channel,
					detected,
					detection,
					(value) => {
						if (typeof value !== 'boolean') throw communicationFailure();
						return value
							? Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL
							: Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
					},
					undefined,
					fault,
				);
			} else {
				// Required by HAP, but concentration alone cannot prove a detection state.
				bindUnavailableCharacteristic(context, detection, fault);
			}
			for (const [category, type] of [
				[PropertyCategory.CONCENTRATION, Characteristic.CarbonDioxideLevel],
				[PropertyCategory.PEAK_LEVEL, Characteristic.CarbonDioxidePeakLevel],
			] as const) {
				const property = this.findCarbonDioxideLevel(channel, category);
				if (!property) continue;
				const characteristic = service.getCharacteristic(type);
				this.bindCharacteristic(
					context,
					device,
					channel,
					property,
					characteristic,
					(value) => validateHapNumber(characteristic, value),
					undefined,
					fault,
					undefined,
					(current) => {
						if (current.dataType !== DataTypeType.FLOAT || current.unit !== 'ppm') throw communicationFailure();
					},
				);
			}
			addedService = true;
		}

		// 1. Temperature Sensor
		const tempChannels = this.findChannels(device, ChannelCategory.TEMPERATURE).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.TEMPERATURE),
		);
		for (const tempChannel of tempChannels) {
			const tempProp = this.findProperty(tempChannel, PropertyCategory.TEMPERATURE);
			const serviceName =
				tempChannels.length === 1
					? `${device.name} Temperature`
					: `${device.name} Temperature ${tempChannel.name || tempChannel.id}`;
			const tempService = accessory.addService(Service.TemperatureSensor, serviceName, tempChannel.id);
			const tempChar = tempService.getCharacteristic(Characteristic.CurrentTemperature);
			this.bindCharacteristic(
				context,
				device,
				tempChannel,
				tempProp,
				tempChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const num = Number(unwrapped);
					return isNaN(num) ? 0 : num;
				},
				undefined,
				tempService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 2. Humidity Sensor
		const humChannels = this.findChannels(device, ChannelCategory.HUMIDITY).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.HUMIDITY),
		);
		for (const humChannel of humChannels) {
			const humProp = this.findProperty(humChannel, PropertyCategory.HUMIDITY);
			const serviceName =
				humChannels.length === 1
					? `${device.name} Humidity`
					: `${device.name} Humidity ${humChannel.name || humChannel.id}`;
			const humService = accessory.addService(Service.HumiditySensor, serviceName, humChannel.id);
			const humChar = humService.getCharacteristic(Characteristic.CurrentRelativeHumidity);
			this.bindCharacteristic(
				context,
				device,
				humChannel,
				humProp,
				humChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const num = Number(unwrapped);
					return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
				},
				undefined,
				humService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 3. Motion Sensor
		const motionChannels = this.findChannels(device, ChannelCategory.MOTION).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.DETECTED),
		);
		for (const motionChannel of motionChannels) {
			const motionProp = this.findProperty(motionChannel, PropertyCategory.DETECTED);
			const serviceName =
				motionChannels.length === 1
					? `${device.name} Motion`
					: `${device.name} Motion ${motionChannel.name || motionChannel.id}`;
			const motionService = accessory.addService(Service.MotionSensor, serviceName, motionChannel.id);
			const motionChar = motionService.getCharacteristic(Characteristic.MotionDetected);
			this.bindCharacteristic(
				context,
				device,
				motionChannel,
				motionProp,
				motionChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					return Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1);
				},
				undefined,
				motionService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 4. Contact Sensor (Door/Window)
		const contactChannels = this.findChannels(device, ChannelCategory.CONTACT).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.DETECTED),
		);
		for (const contactChannel of contactChannels) {
			const contactProp = this.findProperty(contactChannel, PropertyCategory.DETECTED);
			const serviceName =
				contactChannels.length === 1
					? `${device.name} Contact`
					: `${device.name} Contact ${contactChannel.name || contactChannel.id}`;
			const contactService = accessory.addService(Service.ContactSensor, serviceName, contactChannel.id);
			const contactChar = contactService.getCharacteristic(Characteristic.ContactSensorState);
			this.bindCharacteristic(
				context,
				device,
				contactChannel,
				contactProp,
				contactChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const isOpen = Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1 || unwrapped === 'open');
					return isOpen
						? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
						: Characteristic.ContactSensorState.CONTACT_DETECTED;
				},
				undefined,
				contactService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 5. Occupancy Sensor
		const occChannels = this.findChannels(device, ChannelCategory.OCCUPANCY).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.DETECTED),
		);
		for (const occChannel of occChannels) {
			const occProp = this.findProperty(occChannel, PropertyCategory.DETECTED);
			const serviceName =
				occChannels.length === 1
					? `${device.name} Occupancy`
					: `${device.name} Occupancy ${occChannel.name || occChannel.id}`;
			const occService = accessory.addService(Service.OccupancySensor, serviceName, occChannel.id);
			const occChar = occService.getCharacteristic(Characteristic.OccupancyDetected);
			this.bindCharacteristic(
				context,
				device,
				occChannel,
				occProp,
				occChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const isOcc = Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1);
					return isOcc
						? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
						: Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
				},
				undefined,
				occService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 6. Light / Illuminance Sensor
		const lightChannels = this.findChannels(device, ChannelCategory.ILLUMINANCE).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.ILLUMINANCE),
		);
		for (const lightChannel of lightChannels) {
			const lightProp = this.findProperty(lightChannel, PropertyCategory.ILLUMINANCE);
			const serviceName =
				lightChannels.length === 1
					? `${device.name} Light Level`
					: `${device.name} Light Level ${lightChannel.name || lightChannel.id}`;
			const lightService = accessory.addService(Service.LightSensor, serviceName, lightChannel.id);
			const lightChar = lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel);
			this.bindCharacteristic(
				context,
				device,
				lightChannel,
				lightProp,
				lightChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const num = Number(unwrapped);
					return isNaN(num) || num <= 0 ? 0.0001 : num;
				},
				undefined,
				lightService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 7. Leak Sensor
		const leakChannels = this.findChannels(device, ChannelCategory.LEAK).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.DETECTED),
		);
		for (const leakChannel of leakChannels) {
			const leakProp = this.findProperty(leakChannel, PropertyCategory.DETECTED);
			const serviceName =
				leakChannels.length === 1 ? `${device.name} Leak` : `${device.name} Leak ${leakChannel.name || leakChannel.id}`;
			const leakService = accessory.addService(Service.LeakSensor, serviceName, leakChannel.id);
			const leakChar = leakService.getCharacteristic(Characteristic.LeakDetected);
			this.bindCharacteristic(
				context,
				device,
				leakChannel,
				leakProp,
				leakChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const isLeak = Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1);
					return isLeak ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED;
				},
				undefined,
				leakService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		// 8. Smoke Sensor
		const smokeChannels = this.findChannels(device, ChannelCategory.SMOKE).filter(
			(ch) => !!this.findProperty(ch, PropertyCategory.DETECTED),
		);
		for (const smokeChannel of smokeChannels) {
			const smokeProp = this.findProperty(smokeChannel, PropertyCategory.DETECTED);
			const serviceName =
				smokeChannels.length === 1
					? `${device.name} Smoke`
					: `${device.name} Smoke ${smokeChannel.name || smokeChannel.id}`;
			const smokeService = accessory.addService(Service.SmokeSensor, serviceName, smokeChannel.id);
			const smokeChar = smokeService.getCharacteristic(Characteristic.SmokeDetected);
			this.bindCharacteristic(
				context,
				device,
				smokeChannel,
				smokeProp,
				smokeChar,
				(val) => {
					const unwrapped = this.unwrapValue(val);
					const isSmoke = Boolean(unwrapped === true || unwrapped === 'true' || unwrapped === 1);
					return isSmoke
						? Characteristic.SmokeDetected.SMOKE_DETECTED
						: Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
				},
				undefined,
				smokeService.getCharacteristic(Characteristic.StatusFault),
			);
			addedService = true;
		}

		return addedService;
	}
}
