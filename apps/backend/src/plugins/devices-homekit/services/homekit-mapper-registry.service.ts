import { Accessory } from '@homebridge/hap-nodejs';
import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { BatteryMapper } from '../mappers/battery.mapper';
import {
	CharacteristicBinding,
	HomeKitMapperContext,
	IHomeKitAccessoryMapper,
	PropertyEventListener,
} from '../mappers/homekit-mapper.interface';
import { LightbulbMapper } from '../mappers/lightbulb.mapper';
import { LockMapper } from '../mappers/lock.mapper';
import { OutletMapper } from '../mappers/outlet.mapper';
import { SensorMapper } from '../mappers/sensor.mapper';
import { SwitchMapper } from '../mappers/switch.mapper';
import { ThermostatMapper } from '../mappers/thermostat.mapper';
import { WindowCoveringMapper } from '../mappers/window-covering.mapper';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';

export interface RegistrySnapshot {
	propertyBindings: Map<string, CharacteristicBinding[]>;
	propertyListeners: Map<string, PropertyEventListener[]>;
	deviceProperties: Map<string, Set<string>>;
}

export interface StagedAccessory {
	accessory: Accessory;
	deviceId: string;
	bindings: CharacteristicBinding[];
	listeners: PropertyEventListener[];
}

@Injectable()
export class HomeKitMapperRegistryService {
	private readonly logger = new Logger(HomeKitMapperRegistryService.name);
	private readonly mappers: IHomeKitAccessoryMapper[] = [];

	// propertyId -> bindings
	private readonly propertyBindings = new Map<string, CharacteristicBinding[]>();
	// propertyId -> listeners
	private readonly propertyListeners = new Map<string, PropertyEventListener[]>();
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

	canMap(device: DeviceEntity): boolean {
		return this.findMapper(device) !== null;
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

	buildAccessory(device: DeviceEntity, commandDispatcher: HomeKitCommandDispatcher): StagedAccessory | null {
		const mapper = this.findMapper(device);
		if (!mapper) {
			this.logger.debug(`No compatible HomeKit mapper found for device: ${device.name} (${device.id})`);
			return null;
		}

		// Stage bindings and listeners to avoid side effects on live registry
		const stagedBindings: CharacteristicBinding[] = [];
		const stagedListeners: PropertyEventListener[] = [];

		const context: HomeKitMapperContext = {
			commandDispatcher,
			registerBinding: (binding: CharacteristicBinding) => {
				stagedBindings.push(binding);
			},
			registerPropertyListener: (listener: PropertyEventListener) => {
				stagedListeners.push(listener);
			},
		};

		const accessory = mapper.buildAccessory(device, context);
		if (!accessory) {
			return null;
		}

		// Check and attach optional battery service
		BatteryMapper.attachBatteryService(accessory, device, context);

		return {
			accessory,
			deviceId: device.id,
			bindings: stagedBindings,
			listeners: stagedListeners,
		};
	}

	commitStaged(staged: StagedAccessory): void {
		this.clearDeviceBindings(staged.deviceId);

		for (const binding of staged.bindings) {
			const existing = this.propertyBindings.get(binding.propertyId) ?? [];
			existing.push(binding);
			this.propertyBindings.set(binding.propertyId, existing);

			let devProps = this.deviceProperties.get(binding.deviceId);
			if (!devProps) {
				devProps = new Set();
				this.deviceProperties.set(binding.deviceId, devProps);
			}
			devProps.add(binding.propertyId);
		}

		for (const listener of staged.listeners) {
			const existing = this.propertyListeners.get(listener.propertyId) ?? [];
			existing.push(listener);
			this.propertyListeners.set(listener.propertyId, existing);

			let devProps = this.deviceProperties.get(listener.deviceId);
			if (!devProps) {
				devProps = new Set();
				this.deviceProperties.set(listener.deviceId, devProps);
			}
			devProps.add(listener.propertyId);
		}
	}

	getBindingsForProperty(propertyId: string): CharacteristicBinding[] {
		return this.propertyBindings.get(propertyId) ?? [];
	}

	getListenersForProperty(propertyId: string): PropertyEventListener[] {
		return this.propertyListeners.get(propertyId) ?? [];
	}

	clearDeviceBindings(deviceId: string): void {
		const propIds = this.deviceProperties.get(deviceId);
		if (propIds) {
			for (const propId of propIds) {
				const bindings = this.propertyBindings.get(propId) ?? [];
				const remainingBindings = bindings.filter((b) => b.deviceId !== deviceId);
				if (remainingBindings.length === 0) {
					this.propertyBindings.delete(propId);
				} else {
					this.propertyBindings.set(propId, remainingBindings);
				}

				const listeners = this.propertyListeners.get(propId) ?? [];
				const remainingListeners = listeners.filter((l) => l.deviceId !== deviceId);
				if (remainingListeners.length === 0) {
					this.propertyListeners.delete(propId);
				} else {
					this.propertyListeners.set(propId, remainingListeners);
				}
			}
			this.deviceProperties.delete(deviceId);
		}
	}

	clearAllBindings(): void {
		this.propertyBindings.clear();
		this.propertyListeners.clear();
		this.deviceProperties.clear();
	}

	getSnapshot(): RegistrySnapshot {
		const cloneBindings = new Map<string, CharacteristicBinding[]>();
		for (const [k, v] of this.propertyBindings.entries()) {
			cloneBindings.set(k, [...v]);
		}
		const cloneListeners = new Map<string, PropertyEventListener[]>();
		for (const [k, v] of this.propertyListeners.entries()) {
			cloneListeners.set(k, [...v]);
		}
		const cloneProps = new Map<string, Set<string>>();
		for (const [k, v] of this.deviceProperties.entries()) {
			cloneProps.set(k, new Set(v));
		}
		return {
			propertyBindings: cloneBindings,
			propertyListeners: cloneListeners,
			deviceProperties: cloneProps,
		};
	}

	restoreSnapshot(snapshot: RegistrySnapshot): void {
		this.clearAllBindings();
		for (const [k, v] of snapshot.propertyBindings.entries()) {
			this.propertyBindings.set(k, [...v]);
		}
		for (const [k, v] of snapshot.propertyListeners.entries()) {
			this.propertyListeners.set(k, [...v]);
		}
		for (const [k, v] of snapshot.deviceProperties.entries()) {
			this.deviceProperties.set(k, new Set(v));
		}
	}
}
