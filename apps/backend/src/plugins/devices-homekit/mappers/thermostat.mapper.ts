import { Accessory, Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { BaseHomeKitMapper } from './base.mapper';
import { HomeKitMapperContext } from './homekit-mapper.interface';
import { ThermostatCoordinator } from './thermostat-coordinator';

export class ThermostatMapper extends BaseHomeKitMapper {
	canMap(device: DeviceEntity): boolean {
		const ambient = this.findAmbientTemperature(device);
		if (!ambient) {
			return false;
		}

		const heaterChannel =
			this.findChannel(device, ChannelCategory.HEATER) ?? this.findChannel(device, ChannelCategory.THERMOSTAT);
		const coolerChannel = this.findChannel(device, ChannelCategory.COOLER);

		return this.isValidHeaterOrCoolerChannel(heaterChannel) || this.isValidHeaterOrCoolerChannel(coolerChannel);
	}

	getSuggestedServiceType(_device: DeviceEntity): string {
		return 'thermostat';
	}

	buildAccessory(device: DeviceEntity, context: HomeKitMapperContext): Accessory | null {
		const ambient = this.findAmbientTemperature(device);
		if (!ambient) {
			return null;
		}

		const heaterChannel =
			this.findChannel(device, ChannelCategory.HEATER) ?? this.findChannel(device, ChannelCategory.THERMOSTAT);
		const coolerChannel = this.findChannel(device, ChannelCategory.COOLER);

		const validHeater = this.isValidHeaterOrCoolerChannel(heaterChannel) ? heaterChannel : undefined;
		const validCooler = this.isValidHeaterOrCoolerChannel(coolerChannel) ? coolerChannel : undefined;

		if (!validHeater && !validCooler) {
			return null;
		}

		const accessory = this.createBaseAccessory(device, Categories.THERMOSTAT);
		const service = accessory.addService(Service.Thermostat, device.name);

		service
			.getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.onGet(() => Characteristic.TemperatureDisplayUnits.CELSIUS);

		const thermostatChannel = this.findChannel(device, ChannelCategory.THERMOSTAT);
		const lockedProp =
			(thermostatChannel && this.findProperty(thermostatChannel, PropertyCategory.LOCKED)) ??
			(validHeater && this.findProperty(validHeater, PropertyCategory.LOCKED)) ??
			(validCooler && this.findProperty(validCooler, PropertyCategory.LOCKED)) ??
			(ambient.channel && this.findProperty(ambient.channel, PropertyCategory.LOCKED));

		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambient.channel,
			ambientTempProperty: ambient.property,
			heaterChannel: validHeater,
			heaterOnProperty: validHeater ? this.findProperty(validHeater, PropertyCategory.ON) : undefined,
			heaterTempProperty: validHeater ? this.findProperty(validHeater, PropertyCategory.TEMPERATURE) : undefined,
			heaterStatusProperty: validHeater ? this.findProperty(validHeater, PropertyCategory.STATUS) : undefined,
			coolerChannel: validCooler,
			coolerOnProperty: validCooler ? this.findProperty(validCooler, PropertyCategory.ON) : undefined,
			coolerTempProperty: validCooler ? this.findProperty(validCooler, PropertyCategory.TEMPERATURE) : undefined,
			coolerStatusProperty: validCooler ? this.findProperty(validCooler, PropertyCategory.STATUS) : undefined,
			lockedProperty: lockedProp,
		});

		return accessory;
	}

	private findAmbientTemperature(
		device: DeviceEntity,
	): { channel: ChannelEntity; property: ChannelPropertyEntity } | null {
		const tempChannel = this.findChannel(device, ChannelCategory.TEMPERATURE);
		if (tempChannel) {
			const tempProp = this.findProperty(tempChannel, PropertyCategory.TEMPERATURE);
			if (
				tempProp &&
				tempProp.permissions.includes(PermissionType.READ_ONLY) &&
				!tempProp.permissions.includes(PermissionType.READ_WRITE)
			) {
				return { channel: tempChannel, property: tempProp };
			}
		}

		// Fallback: look for a distinct read-only temperature property not on heater/cooler
		for (const ch of device.channels ?? []) {
			if (
				ch.category === ChannelCategory.HEATER ||
				ch.category === ChannelCategory.COOLER ||
				ch.category === ChannelCategory.THERMOSTAT
			) {
				continue;
			}
			const prop = this.findProperty(ch, PropertyCategory.TEMPERATURE);
			if (
				prop &&
				prop.permissions.includes(PermissionType.READ_ONLY) &&
				!prop.permissions.includes(PermissionType.READ_WRITE)
			) {
				return { channel: ch, property: prop };
			}
		}

		return null;
	}

	private isValidHeaterOrCoolerChannel(channel?: ChannelEntity): boolean {
		if (!channel) {
			return false;
		}
		const onProp = this.findProperty(channel, PropertyCategory.ON);
		const tempProp = this.findProperty(channel, PropertyCategory.TEMPERATURE);
		const isWritable = (p?: ChannelPropertyEntity) =>
			!!p && p.permissions.some((perm) => [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(perm));

		return isWritable(onProp) && isWritable(tempProp);
	}
}
