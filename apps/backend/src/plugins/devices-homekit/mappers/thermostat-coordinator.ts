import { Characteristic, CharacteristicValue, Perms, Service } from '@homebridge/hap-nodejs';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext, PropertyEventListener } from './homekit-mapper.interface';

export interface ThermostatCoordinatorConfig {
	device: DeviceEntity;
	service: Service;
	context: HomeKitMapperContext;
	ambientTempChannel: ChannelEntity;
	ambientTempProperty: ChannelPropertyEntity;
	heaterChannel?: ChannelEntity;
	heaterOnProperty?: ChannelPropertyEntity;
	heaterTempProperty?: ChannelPropertyEntity;
	heaterStatusProperty?: ChannelPropertyEntity;
	coolerChannel?: ChannelEntity;
	coolerOnProperty?: ChannelPropertyEntity;
	coolerTempProperty?: ChannelPropertyEntity;
	coolerStatusProperty?: ChannelPropertyEntity;
	lockedProperty?: ChannelPropertyEntity;
}

export class ThermostatCoordinator {
	private readonly values = new Map<string, unknown>();

	private readonly currentHeatingCoolingChar: Characteristic;
	private readonly targetHeatingCoolingChar: Characteristic;
	private readonly currentTempChar: Characteristic;
	private readonly targetTempChar: Characteristic;
	private heatingThresholdChar?: Characteristic;
	private coolingThresholdChar?: Characteristic;

	constructor(private readonly config: ThermostatCoordinatorConfig) {
		const { service } = config;

		this.currentHeatingCoolingChar = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
		this.targetHeatingCoolingChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);
		this.currentTempChar = service.getCharacteristic(Characteristic.CurrentTemperature);
		this.targetTempChar = service.getCharacteristic(Characteristic.TargetTemperature);

		this.initValues();
		this.configureValidValues();
		this.setupGettersAndSetters();
		this.registerEventListeners();
		this.refreshCharacteristics();
	}

	private initValues(): void {
		const registerProp = (prop?: ChannelPropertyEntity) => {
			if (!prop) return;
			const unwrapped =
				prop.value !== null && typeof prop.value === 'object' && 'value' in (prop.value as object)
					? (prop.value as { value?: unknown }).value
					: prop.value;
			this.values.set(prop.id, unwrapped);
		};

		registerProp(this.config.ambientTempProperty);
		registerProp(this.config.heaterOnProperty);
		registerProp(this.config.heaterTempProperty);
		registerProp(this.config.heaterStatusProperty);
		registerProp(this.config.coolerOnProperty);
		registerProp(this.config.coolerTempProperty);
		registerProp(this.config.coolerStatusProperty);
		registerProp(this.config.lockedProperty);
	}

	private configureValidValues(): void {
		const validValues: number[] = [Characteristic.TargetHeatingCoolingState.OFF];
		const hasHeater = !!this.config.heaterOnProperty;
		const hasCooler = !!this.config.coolerOnProperty;

		if (hasHeater) {
			validValues.push(Characteristic.TargetHeatingCoolingState.HEAT);
		}
		if (hasCooler) {
			validValues.push(Characteristic.TargetHeatingCoolingState.COOL);
		}
		if (hasHeater && hasCooler) {
			validValues.push(Characteristic.TargetHeatingCoolingState.AUTO);

			this.heatingThresholdChar = this.config.service.getCharacteristic(Characteristic.HeatingThresholdTemperature);
			this.coolingThresholdChar = this.config.service.getCharacteristic(Characteristic.CoolingThresholdTemperature);
		}

		this.targetHeatingCoolingChar.setProps({
			validValues,
		});
	}

	private setupGettersAndSetters(): void {
		// CurrentTemperature
		this.currentTempChar.onGet(() => this.getAmbientTemperature());

		// TargetTemperature
		this.targetTempChar.onGet(() => this.getTargetTemperature());
		this.targetTempChar.onSet(async (value: CharacteristicValue) => {
			const targetVal = Number(value);
			const targetMode = this.deriveTargetHeatingCoolingState();
			const commands: Array<{ propertyId: string; value: unknown }> = [];

			if (targetMode === Characteristic.TargetHeatingCoolingState.HEAT && this.config.heaterTempProperty) {
				commands.push({ propertyId: this.config.heaterTempProperty.id, value: targetVal });
			} else if (targetMode === Characteristic.TargetHeatingCoolingState.COOL && this.config.coolerTempProperty) {
				commands.push({ propertyId: this.config.coolerTempProperty.id, value: targetVal });
			} else if (targetMode === Characteristic.TargetHeatingCoolingState.AUTO) {
				if (this.config.heaterTempProperty) {
					commands.push({ propertyId: this.config.heaterTempProperty.id, value: targetVal });
				}
				if (this.config.coolerTempProperty) {
					commands.push({ propertyId: this.config.coolerTempProperty.id, value: targetVal });
				}
			} else {
				// OFF: update whichever is available
				if (this.config.heaterTempProperty) {
					commands.push({ propertyId: this.config.heaterTempProperty.id, value: targetVal });
				} else if (this.config.coolerTempProperty) {
					commands.push({ propertyId: this.config.coolerTempProperty.id, value: targetVal });
				}
			}

			if (commands.length > 0) {
				await this.config.context.commandDispatcher.dispatchBatch(commands);
				for (const cmd of commands) {
					this.values.set(cmd.propertyId, cmd.value);
				}
				this.refreshCharacteristics();
			}
		});

		// CurrentHeatingCoolingState
		this.currentHeatingCoolingChar.onGet(() => this.deriveCurrentHeatingCoolingState());

		// TargetHeatingCoolingState
		this.targetHeatingCoolingChar.onGet(() => this.deriveTargetHeatingCoolingState());
		this.targetHeatingCoolingChar.onSet(async (value: CharacteristicValue) => {
			const mode = Number(value);
			const commands: Array<{ propertyId: string; value: unknown }> = [];

			if (mode === Characteristic.TargetHeatingCoolingState.OFF) {
				if (this.config.heaterOnProperty) {
					commands.push({ propertyId: this.config.heaterOnProperty.id, value: false });
				}
				if (this.config.coolerOnProperty) {
					commands.push({ propertyId: this.config.coolerOnProperty.id, value: false });
				}
			} else if (mode === Characteristic.TargetHeatingCoolingState.HEAT) {
				if (this.config.heaterOnProperty) {
					commands.push({ propertyId: this.config.heaterOnProperty.id, value: true });
				}
				if (this.config.coolerOnProperty) {
					commands.push({ propertyId: this.config.coolerOnProperty.id, value: false });
				}
			} else if (mode === Characteristic.TargetHeatingCoolingState.COOL) {
				if (this.config.heaterOnProperty) {
					commands.push({ propertyId: this.config.heaterOnProperty.id, value: false });
				}
				if (this.config.coolerOnProperty) {
					commands.push({ propertyId: this.config.coolerOnProperty.id, value: true });
				}
			} else if (mode === Characteristic.TargetHeatingCoolingState.AUTO) {
				if (this.config.heaterOnProperty) {
					commands.push({ propertyId: this.config.heaterOnProperty.id, value: true });
				}
				if (this.config.coolerOnProperty) {
					commands.push({ propertyId: this.config.coolerOnProperty.id, value: true });
				}
			}

			if (commands.length > 0) {
				await this.config.context.commandDispatcher.dispatchBatch(commands);
				for (const cmd of commands) {
					this.values.set(cmd.propertyId, cmd.value);
				}
				this.refreshCharacteristics();
			}
		});

		// HeatingThresholdTemperature & CoolingThresholdTemperature (for AUTO mode)
		if (this.heatingThresholdChar && this.config.heaterTempProperty) {
			const heaterTempProp = this.config.heaterTempProperty;
			this.heatingThresholdChar.onGet(() => {
				const val = this.values.get(heaterTempProp.id);
				return typeof val === 'number' ? val : 20;
			});
			this.heatingThresholdChar.onSet(async (value: CharacteristicValue) => {
				const target = Number(value);
				await this.config.context.commandDispatcher.dispatch(heaterTempProp.id, target);
				this.values.set(heaterTempProp.id, target);
				this.refreshCharacteristics();
			});
		}

		if (this.coolingThresholdChar && this.config.coolerTempProperty) {
			const coolerTempProp = this.config.coolerTempProperty;
			this.coolingThresholdChar.onGet(() => {
				const val = this.values.get(coolerTempProp.id);
				return typeof val === 'number' ? val : 25;
			});
			this.coolingThresholdChar.onSet(async (value: CharacteristicValue) => {
				const target = Number(value);
				await this.config.context.commandDispatcher.dispatch(coolerTempProp.id, target);
				this.values.set(coolerTempProp.id, target);
				this.refreshCharacteristics();
			});
		}

		// Child Lock
		if (this.config.lockedProperty) {
			const lockProp = this.config.lockedProperty;
			const lockChar = this.config.service.getCharacteristic(Characteristic.LockPhysicalControls);
			lockChar.onGet(() => {
				const val = this.values.get(lockProp.id);
				return val === true || val === 'true' || val === 1 || val === 'locked'
					? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
					: Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
			});

			const isWritable = lockProp.permissions.some((p) =>
				[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(p),
			);
			if (isWritable && lockChar.props.perms.includes(Perms.PAIRED_WRITE)) {
				lockChar.onSet(async (value: CharacteristicValue) => {
					const isLocked = value === Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
					await this.config.context.commandDispatcher.dispatch(lockProp.id, isLocked);
					this.values.set(lockProp.id, isLocked);
				});
			}
		}
	}

	private registerEventListeners(): void {
		const propsToListen = [
			this.config.ambientTempProperty,
			this.config.heaterOnProperty,
			this.config.heaterTempProperty,
			this.config.heaterStatusProperty,
			this.config.coolerOnProperty,
			this.config.coolerTempProperty,
			this.config.coolerStatusProperty,
			this.config.lockedProperty,
		].filter((p): p is ChannelPropertyEntity => !!p);

		for (const prop of propsToListen) {
			const listener: PropertyEventListener = {
				deviceId: this.config.device.id,
				propertyId: prop.id,
				onPropertyChanged: (_property, rawValue) => {
					this.values.set(prop.id, rawValue);
					this.refreshCharacteristics();
				},
			};
			this.config.context.registerPropertyListener(listener);
		}
	}

	private refreshCharacteristics(): void {
		this.currentTempChar.updateValue(this.getAmbientTemperature());
		this.currentHeatingCoolingChar.updateValue(this.deriveCurrentHeatingCoolingState());
		this.targetHeatingCoolingChar.updateValue(this.deriveTargetHeatingCoolingState());
		this.targetTempChar.updateValue(this.getTargetTemperature());

		if (this.heatingThresholdChar && this.config.heaterTempProperty) {
			const val = this.values.get(this.config.heaterTempProperty.id);
			if (typeof val === 'number') {
				this.heatingThresholdChar.updateValue(val);
			}
		}
		if (this.coolingThresholdChar && this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			if (typeof val === 'number') {
				this.coolingThresholdChar.updateValue(val);
			}
		}
	}

	private getAmbientTemperature(): number {
		const val = this.values.get(this.config.ambientTempProperty.id);
		const num = Number(val);
		return isNaN(num) ? 20 : num;
	}

	private getTargetTemperature(): number {
		const mode = this.deriveTargetHeatingCoolingState();
		if (mode === Characteristic.TargetHeatingCoolingState.COOL && this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			const num = Number(val);
			return isNaN(num) ? 25 : num;
		}
		if (this.config.heaterTempProperty) {
			const val = this.values.get(this.config.heaterTempProperty.id);
			const num = Number(val);
			return isNaN(num) ? 20 : num;
		}
		if (this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			const num = Number(val);
			return isNaN(num) ? 25 : num;
		}
		return 20;
	}

	/**
	 * Tri-state evaluation:
	 * Active: true | 'heating' | 'cooling'
	 * Inactive: false | 'idle' | 'off'
	 * Absent/Unknown: null | undefined
	 * Rule: Active or Inactive is strictly authoritative. Fall back to temp comparison only if Absent/Unknown.
	 */
	private deriveCurrentHeatingCoolingState(): number {
		const ambientTemp = this.getAmbientTemperature();

		// Check Heater
		if (this.config.heaterOnProperty) {
			const isOn = Boolean(this.values.get(this.config.heaterOnProperty.id));
			if (isOn) {
				const statusRaw = this.config.heaterStatusProperty
					? this.values.get(this.config.heaterStatusProperty.id)
					: undefined;

				if (statusRaw === true || statusRaw === 'heating') {
					return Characteristic.CurrentHeatingCoolingState.HEAT;
				}
				if (statusRaw === false || statusRaw === 'idle' || statusRaw === 'off') {
					// Authoritatively idle
				} else if (statusRaw === undefined || statusRaw === null) {
					// Fallback heuristic: compare target to ambient
					const targetTemp = this.config.heaterTempProperty
						? Number(this.values.get(this.config.heaterTempProperty.id))
						: NaN;
					if (!isNaN(targetTemp) && targetTemp > ambientTemp) {
						return Characteristic.CurrentHeatingCoolingState.HEAT;
					}
				}
			}
		}

		// Check Cooler
		if (this.config.coolerOnProperty) {
			const isOn = Boolean(this.values.get(this.config.coolerOnProperty.id));
			if (isOn) {
				const statusRaw = this.config.coolerStatusProperty
					? this.values.get(this.config.coolerStatusProperty.id)
					: undefined;

				if (statusRaw === true || statusRaw === 'cooling') {
					return Characteristic.CurrentHeatingCoolingState.COOL;
				}
				if (statusRaw === false || statusRaw === 'idle' || statusRaw === 'off') {
					// Authoritatively idle
				} else if (statusRaw === undefined || statusRaw === null) {
					// Fallback heuristic: compare target to ambient
					const targetTemp = this.config.coolerTempProperty
						? Number(this.values.get(this.config.coolerTempProperty.id))
						: NaN;
					if (!isNaN(targetTemp) && targetTemp < ambientTemp) {
						return Characteristic.CurrentHeatingCoolingState.COOL;
					}
				}
			}
		}

		return Characteristic.CurrentHeatingCoolingState.OFF;
	}

	private deriveTargetHeatingCoolingState(): number {
		const heaterOn = this.config.heaterOnProperty ? Boolean(this.values.get(this.config.heaterOnProperty.id)) : false;
		const coolerOn = this.config.coolerOnProperty ? Boolean(this.values.get(this.config.coolerOnProperty.id)) : false;

		if (heaterOn && coolerOn) {
			return Characteristic.TargetHeatingCoolingState.AUTO;
		}
		if (heaterOn) {
			return Characteristic.TargetHeatingCoolingState.HEAT;
		}
		if (coolerOn) {
			return Characteristic.TargetHeatingCoolingState.COOL;
		}
		return Characteristic.TargetHeatingCoolingState.OFF;
	}
}
