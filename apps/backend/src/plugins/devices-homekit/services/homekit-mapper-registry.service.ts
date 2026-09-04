import { Accessory } from '@homebridge/hap-nodejs';
import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { BatteryMapper } from '../mappers/battery.mapper';
import {
	CharacteristicBinding,
	HomeKitMapperContext,
	IHomeKitAccessoryMapper,
} from '../mappers/homekit-mapper.interface';
import { LightbulbMapper } from '../mappers/lightbulb.mapper';
import { LockMapper } from '../mappers/lock.mapper';
import { OutletMapper } from '../mappers/outlet.mapper';
import { SensorMapper } from '../mappers/sensor.mapper';
import { SwitchMapper } from '../mappers/switch.mapper';
import { ThermostatMapper } from '../mappers/thermostat.mapper';
import { WindowCoveringMapper } from '../mappers/window-covering.mapper';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';

@Injectable()
export class HomeKitMapperRegistryService {
	private readonly logger = new Logger(HomeKitMapperRegistryService.name);
	private readonly mappers: IHomeKitAccessoryMapper[] = [];

	// propertyId -> bindings
	private readonly propertyBindings = new Map<string, CharacteristicBinding[]>();
	// deviceId -> propertyIds
	private readonly deviceProperties = new Map<string, Set<string>>();

	constructor() {
		// Register built-in mappers in priority order
		this.mappers.push(new LightbulbMapper());
		this.mappers.push(new SwitchMapper());
		this.mappers.push(new OutletMapper());
		this.mappers.push(new ThermostatMapper());
		this.mappers.push(new WindowCoveringMapper());
		this.mappers.push(new LockMapper());
		this.mappers.push(new SensorMapper());
	}

	findMapper(device: DeviceEntity): IHomeKitAccessoryMapper | null {
		for (const mapper of this.mappers) {
			if (mapper.canMap(device)) {
				return mapper;
			}
		}
		return null;
	}

	getSuggestedServiceType(device: DeviceEntity): string | null {
		const mapper = this.findMapper(device);
		return mapper ? mapper.getSuggestedServiceType(device) : null;
	}

	buildAccessory(device: DeviceEntity, commandDispatcher: HomeKitCommandDispatcher): Accessory | null {
		const mapper = this.findMapper(device);
		if (!mapper) {
			this.logger.debug(`No compatible HomeKit mapper found for device: ${device.name} (${device.id})`);
			return null;
		}

		// Clear previous bindings for this device before re-creating
		this.clearDeviceBindings(device.id);

		const context: HomeKitMapperContext = {
			commandDispatcher,
			registerBinding: (binding: CharacteristicBinding) => {
				const existing = this.propertyBindings.get(binding.propertyId) ?? [];
				existing.push(binding);
				this.propertyBindings.set(binding.propertyId, existing);

				let devProps = this.deviceProperties.get(binding.deviceId);
				if (!devProps) {
					devProps = new Set();
					this.deviceProperties.set(binding.deviceId, devProps);
				}
				devProps.add(binding.propertyId);
			},
		};

		const accessory = mapper.buildAccessory(device, context);
		if (!accessory) {
			return null;
		}

		// Check and attach optional battery service
		BatteryMapper.attachBatteryService(accessory, device, context);

		return accessory;
	}

	getBindingsForProperty(propertyId: string): CharacteristicBinding[] {
		return this.propertyBindings.get(propertyId) ?? [];
	}

	clearDeviceBindings(deviceId: string): void {
		const propIds = this.deviceProperties.get(deviceId);
		if (propIds) {
			for (const propId of propIds) {
				const bindings = this.propertyBindings.get(propId) ?? [];
				const remaining = bindings.filter((b) => b.deviceId !== deviceId);
				if (remaining.length === 0) {
					this.propertyBindings.delete(propId);
				} else {
					this.propertyBindings.set(propId, remaining);
				}
			}
			this.deviceProperties.delete(deviceId);
		}
	}

	clearAllBindings(): void {
		this.propertyBindings.clear();
		this.deviceProperties.clear();
	}
}
