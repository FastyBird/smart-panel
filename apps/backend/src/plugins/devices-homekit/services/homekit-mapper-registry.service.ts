import { Accessory, HAPStatus, HapStatusError } from '@homebridge/hap-nodejs';
import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { BatteryMapper } from '../mappers/battery.mapper';
import { ButtonMapper } from '../mappers/button.mapper';
import {
	CharacteristicBinding,
	HomeKitMapperContext,
	IHomeKitAccessoryMapper,
	InputOccurrenceListener,
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

interface DeviceAvailabilityState {
	online: boolean;
	initialized: boolean;
	revision: number;
	propertyRevisions: Map<string, number>;
}

interface AccessoryAvailability {
	active: boolean;
	state: DeviceAvailabilityState;
}

export interface RegistrySnapshot {
	availability?: Map<string, AccessoryAvailability>;
	deviceStates?: Map<string, DeviceAvailabilityState>;
	propertyBindings: Map<string, CharacteristicBinding[]>;
	propertyListeners: Map<string, PropertyEventListener[]>;
	occurrenceListeners: Map<string, InputOccurrenceListener[]>;
	deviceProperties: Map<string, Set<string>>;
}

export interface StagedAccessory {
	availability?: AccessoryAvailability;
	accessory: Accessory;
	deviceId: string;
	bindings: CharacteristicBinding[];
	listeners: PropertyEventListener[];
	occurrenceListeners: InputOccurrenceListener[];
}

@Injectable()
export class HomeKitMapperRegistryService {
	private readonly logger = new Logger(HomeKitMapperRegistryService.name);
	private readonly mappers: IHomeKitAccessoryMapper[] = [];
	private readonly availability = new Map<string, AccessoryAvailability>();
	private readonly deviceStates = new Map<string, DeviceAvailabilityState>();

	/** Start tracking before an asynchronous entity/status load so a newer event wins. */
	trackDevice(deviceId: string): void {
		if (!this.deviceStates.has(deviceId)) {
			this.deviceStates.set(deviceId, { online: false, initialized: false, revision: 0, propertyRevisions: new Map() });
		}
	}

	setDeviceOnline(deviceId: string, online: boolean): boolean {
		this.trackDevice(deviceId);
		const state = this.deviceStates.get(deviceId);
		if (state.initialized && state.online === online) return false;
		const becameOnline = online;
		state.online = online;
		state.initialized = true;
		state.revision++;
		return becameOnline;
	}

	notePropertyEvent(propertyId: string): void {
		for (const [deviceId, properties] of this.deviceProperties) {
			if (properties.has(propertyId)) {
				const state = this.deviceStates.get(deviceId);
				if (state) state.propertyRevisions.set(propertyId, (state.propertyRevisions.get(propertyId) ?? 0) + 1);
			}
		}
	}

	/** Fences late refresh reads against events, removal, rebuild and stop. */
	captureRefresh(deviceId: string): (propertyId?: string) => boolean {
		const holder = this.availability.get(deviceId);
		const revision = holder?.state.revision;
		const propertyRevisions = new Map(holder?.state.propertyRevisions);
		return (propertyId?: string) =>
			!!holder?.active &&
			this.availability.get(deviceId) === holder &&
			holder.state.online &&
			holder.state.revision === revision &&
			(!propertyId || holder.state.propertyRevisions.get(propertyId) === propertyRevisions.get(propertyId));
	}

	// propertyId -> bindings
	private readonly propertyBindings = new Map<string, CharacteristicBinding[]>();
	// propertyId -> listeners
	private readonly propertyListeners = new Map<string, PropertyEventListener[]>();
	// propertyId -> occurrence listeners
	private readonly occurrenceListeners = new Map<string, InputOccurrenceListener[]>();
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
		this.mappers.push(new ButtonMapper());
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
		const stagedOccurrenceListeners: InputOccurrenceListener[] = [];

		this.trackDevice(device.id);
		const state = this.deviceStates.get(device.id);
		if (!state.initialized) {
			state.online = device.status?.online === true;
			state.initialized = true;
		}
		const availability: AccessoryAvailability = { active: true, state };
		const context: HomeKitMapperContext = {
			availability: {
				isAvailable: () => availability.active && state.online,
				assertAvailable: () => {
					if (!availability.active || !state.online) {
						throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
					}
				},
			},
			commandDispatcher,
			registerBinding: (binding: CharacteristicBinding) => {
				stagedBindings.push(binding);
			},
			registerPropertyListener: (listener: PropertyEventListener) => {
				stagedListeners.push(listener);
			},
			registerOccurrenceListener: (listener: InputOccurrenceListener) => {
				stagedOccurrenceListeners.push(listener);
			},
		};

		const accessory = mapper.buildAccessory(device, context);
		if (!accessory) {
			return null;
		}

		// Check and attach optional button services (for mixed devices or if not already attached)
		ButtonMapper.attachButtonServices(accessory, device, context);

		// Check and attach optional battery service
		BatteryMapper.attachBatteryService(accessory, device, context);

		return {
			accessory,
			availability,
			deviceId: device.id,
			bindings: stagedBindings,
			listeners: stagedListeners,
			occurrenceListeners: stagedOccurrenceListeners,
		};
	}

	commitStaged(staged: StagedAccessory): void {
		this.clearDeviceBindings(staged.deviceId);
		if (staged.availability) {
			staged.availability.active = true;
			this.availability.set(staged.deviceId, staged.availability);
			this.deviceStates.set(staged.deviceId, staged.availability.state);
		}

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

		for (const occListener of staged.occurrenceListeners) {
			const existingProp = this.occurrenceListeners.get(occListener.propertyId) ?? [];
			existingProp.push(occListener);
			this.occurrenceListeners.set(occListener.propertyId, existingProp);

			let devProps = this.deviceProperties.get(occListener.deviceId);
			if (!devProps) {
				devProps = new Set();
				this.deviceProperties.set(occListener.deviceId, devProps);
			}
			devProps.add(occListener.propertyId);
		}
	}

	getDeviceIdForProperty(propertyId: string): string | undefined {
		for (const [deviceId, properties] of this.deviceProperties) {
			if (properties.has(propertyId)) return deviceId;
		}
		return undefined;
	}

	getBindingsForProperty(propertyId: string): CharacteristicBinding[] {
		return this.propertyBindings.get(propertyId) ?? [];
	}

	getListenersForProperty(propertyId: string): PropertyEventListener[] {
		return this.propertyListeners.get(propertyId) ?? [];
	}

	getOccurrenceListeners(propertyId: string, _channelId?: string): InputOccurrenceListener[] {
		return this.occurrenceListeners.get(propertyId) ?? [];
	}

	clearDeviceBindings(deviceId: string): void {
		const holder = this.availability.get(deviceId);
		if (holder) holder.active = false;
		this.availability.delete(deviceId);
		this.deviceStates.delete(deviceId);
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

				const occListeners = this.occurrenceListeners.get(propId) ?? [];
				const remainingOccListeners = occListeners.filter((l) => l.deviceId !== deviceId);
				if (remainingOccListeners.length === 0) {
					this.occurrenceListeners.delete(propId);
				} else {
					this.occurrenceListeners.set(propId, remainingOccListeners);
				}
			}

			this.deviceProperties.delete(deviceId);
		}
	}

	clearAllBindings(): void {
		for (const holder of this.availability.values()) holder.active = false;
		this.availability.clear();
		this.deviceStates.clear();
		this.propertyBindings.clear();
		this.propertyListeners.clear();
		this.occurrenceListeners.clear();
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
		const cloneOcc = new Map<string, InputOccurrenceListener[]>();
		for (const [k, v] of this.occurrenceListeners.entries()) {
			cloneOcc.set(k, [...v]);
		}
		const cloneProps = new Map<string, Set<string>>();
		for (const [k, v] of this.deviceProperties.entries()) {
			cloneProps.set(k, new Set(v));
		}
		return {
			availability: new Map(this.availability),
			deviceStates: new Map(this.deviceStates),
			propertyBindings: cloneBindings,
			propertyListeners: cloneListeners,
			occurrenceListeners: cloneOcc,
			deviceProperties: cloneProps,
		};
	}

	restoreSnapshot(snapshot: RegistrySnapshot): void {
		this.clearAllBindings();
		for (const [k, holder] of snapshot.availability ?? []) {
			holder.active = true;
			this.availability.set(k, holder);
		}
		for (const [k, state] of snapshot.deviceStates ?? []) this.deviceStates.set(k, state);
		for (const [k, v] of snapshot.propertyBindings.entries()) {
			this.propertyBindings.set(k, [...v]);
		}
		for (const [k, v] of snapshot.propertyListeners.entries()) {
			this.propertyListeners.set(k, [...v]);
		}
		if (snapshot.occurrenceListeners) {
			for (const [k, v] of snapshot.occurrenceListeners.entries()) {
				this.occurrenceListeners.set(k, [...v]);
			}
		}
		for (const [k, v] of snapshot.deviceProperties.entries()) {
			this.deviceProperties.set(k, new Set(v));
		}
	}
}
