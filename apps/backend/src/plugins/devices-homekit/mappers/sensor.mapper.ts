import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';

const SENSOR_CHANNEL_CATEGORIES = [
	ChannelCategory.TEMPERATURE,
	ChannelCategory.HUMIDITY,
	ChannelCategory.MOTION,
	ChannelCategory.CONTACT,
	ChannelCategory.OCCUPANCY,
	ChannelCategory.ILLUMINANCE,
	ChannelCategory.LEAK,
	ChannelCategory.SMOKE,
	ChannelCategory.CARBON_MONOXIDE,
	ChannelCategory.AIR_QUALITY,
];

export class SensorMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		if (device.category === DeviceCategory.SENSOR) {
			return true;
		}
		return device.channels?.some((c) => SENSOR_CHANNEL_CATEGORIES.includes(c.category)) ?? false;
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
		let addedService = false;

		// 1. Temperature Sensor
		const tempChannel = this.findChannel(device, ChannelCategory.TEMPERATURE);
		if (tempChannel) {
			const tempProp = this.findProperty(tempChannel, PropertyCategory.TEMPERATURE);
			if (tempProp) {
				const tempService = accessory.addService(Service.TemperatureSensor, `${device.name} Temperature`);
				const tempChar = tempService.getCharacteristic(Characteristic.CurrentTemperature);
				this.bindCharacteristic(context, device, tempChannel, tempProp, tempChar, (val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : num;
				});
				addedService = true;
			}
		}

		// 2. Humidity Sensor
		const humChannel = this.findChannel(device, ChannelCategory.HUMIDITY);
		if (humChannel) {
			const humProp = this.findProperty(humChannel, PropertyCategory.HUMIDITY);
			if (humProp) {
				const humService = accessory.addService(Service.HumiditySensor, `${device.name} Humidity`);
				const humChar = humService.getCharacteristic(Characteristic.CurrentRelativeHumidity);
				this.bindCharacteristic(context, device, humChannel, humProp, humChar, (val) => {
					const num = Number(val);
					return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
				});
				addedService = true;
			}
		}

		// 3. Motion Sensor
		const motionChannel = this.findChannel(device, ChannelCategory.MOTION);
		if (motionChannel) {
			const motionProp = this.findProperty(motionChannel, PropertyCategory.DETECTED);
			if (motionProp) {
				const motionService = accessory.addService(Service.MotionSensor, `${device.name} Motion`);
				const motionChar = motionService.getCharacteristic(Characteristic.MotionDetected);
				this.bindCharacteristic(context, device, motionChannel, motionProp, motionChar, (val) =>
					Boolean(val === true || val === 'true' || val === 1),
				);
				addedService = true;
			}
		}

		// 4. Contact Sensor (Door/Window)
		const contactChannel = this.findChannel(device, ChannelCategory.CONTACT);
		if (contactChannel) {
			const contactProp = this.findProperty(contactChannel, PropertyCategory.DETECTED);
			if (contactProp) {
				const contactService = accessory.addService(Service.ContactSensor, `${device.name} Contact`);
				const contactChar = contactService.getCharacteristic(Characteristic.ContactSensorState);
				// In HomeKit: 0 = CONTACT_DETECTED (closed), 1 = CONTACT_NOT_DETECTED (open)
				this.bindCharacteristic(context, device, contactChannel, contactProp, contactChar, (val) => {
					const isOpen = Boolean(val === true || val === 'true' || val === 1 || val === 'open');
					return isOpen
						? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
						: Characteristic.ContactSensorState.CONTACT_DETECTED;
				});
				addedService = true;
			}
		}

		// 5. Occupancy Sensor
		const occChannel = this.findChannel(device, ChannelCategory.OCCUPANCY);
		if (occChannel) {
			const occProp = this.findProperty(occChannel, PropertyCategory.DETECTED);
			if (occProp) {
				const occService = accessory.addService(Service.OccupancySensor, `${device.name} Occupancy`);
				const occChar = occService.getCharacteristic(Characteristic.OccupancyDetected);
				this.bindCharacteristic(context, device, occChannel, occProp, occChar, (val) => {
					const isOcc = Boolean(val === true || val === 'true' || val === 1);
					return isOcc
						? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
						: Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
				});
				addedService = true;
			}
		}

		// 6. Light / Illuminance Sensor
		const lightChannel = this.findChannel(device, ChannelCategory.ILLUMINANCE);
		if (lightChannel) {
			const lightProp = this.findProperty(lightChannel, PropertyCategory.ILLUMINANCE);
			if (lightProp) {
				const lightService = accessory.addService(Service.LightSensor, `${device.name} Light Level`);
				const lightChar = lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel);
				this.bindCharacteristic(context, device, lightChannel, lightProp, lightChar, (val) => {
					const num = Number(val);
					return isNaN(num) || num <= 0 ? 0.0001 : num;
				});
				addedService = true;
			}
		}

		// 7. Leak Sensor
		const leakChannel = this.findChannel(device, ChannelCategory.LEAK);
		if (leakChannel) {
			const leakProp = this.findProperty(leakChannel, PropertyCategory.DETECTED);
			if (leakProp) {
				const leakService = accessory.addService(Service.LeakSensor, `${device.name} Leak`);
				const leakChar = leakService.getCharacteristic(Characteristic.LeakDetected);
				this.bindCharacteristic(context, device, leakChannel, leakProp, leakChar, (val) => {
					const isLeak = Boolean(val === true || val === 'true' || val === 1);
					return isLeak ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED;
				});
				addedService = true;
			}
		}

		// 8. Smoke Sensor
		const smokeChannel = this.findChannel(device, ChannelCategory.SMOKE);
		if (smokeChannel) {
			const smokeProp = this.findProperty(smokeChannel, PropertyCategory.DETECTED);
			if (smokeProp) {
				const smokeService = accessory.addService(Service.SmokeSensor, `${device.name} Smoke`);
				const smokeChar = smokeService.getCharacteristic(Characteristic.SmokeDetected);
				this.bindCharacteristic(context, device, smokeChannel, smokeProp, smokeChar, (val) => {
					const isSmoke = Boolean(val === true || val === 'true' || val === 1);
					return isSmoke
						? Characteristic.SmokeDetected.SMOKE_DETECTED
						: Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
				});
				addedService = true;
			}
		}

		return addedService ? accessory : null;
	}
}
