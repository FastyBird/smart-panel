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
	private readonly revisions = new Map<string, number>();

	private readonly currentHeatingCoolingChar: Characteristic;
	private readonly targetHeatingCoolingChar: Characteristic;
	private readonly currentTempChar: Characteristic;
	private readonly targetTempChar: Characteristic;
	private heatingThresholdChar?: Characteristic;
	private coolingThresholdChar?: Characteristic;
	private lockPhysicalControlsChar?: Characteristic;

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
			this.revisions.set(prop.id, 0);
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

	private isPropertyWritable(prop?: ChannelPropertyEntity): boolean {
		if (!prop || !Array.isArray(prop.permissions)) return false;
		return prop.permissions.some((p) => [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(p));
	}

	private setupGettersAndSetters(): void {
		// CurrentTemperature
		this.currentTempChar.onGet(() => this.getAmbientTemperature());

		// TargetTemperature
		this.targetTempChar.onGet(() => this.getTargetTemperature());
		const hasWritableTemp =
			this.isPropertyWritable(this.config.heaterTempProperty) ||
			this.isPropertyWritable(this.config.coolerTempProperty);

		if (hasWritableTemp && this.targetTempChar.props.perms.includes(Perms.PAIRED_WRITE)) {
			this.targetTempChar.onSet(async (value: CharacteristicValue) => {
				const targetVal = Number(value);
				const targetMode = this.deriveTargetHeatingCoolingState();
				const commands: Array<{ propertyId: string; value: unknown }> = [];

				if (targetMode === Characteristic.TargetHeatingCoolingState.HEAT) {
					if (this.config.heaterTempProperty && this.isPropertyWritable(this.config.heaterTempProperty)) {
						commands.push({ propertyId: this.config.heaterTempProperty.id, value: targetVal });
					}
				} else if (targetMode === Characteristic.TargetHeatingCoolingState.COOL) {
					if (this.config.coolerTempProperty && this.isPropertyWritable(this.config.coolerTempProperty)) {
						commands.push({ propertyId: this.config.coolerTempProperty.id, value: targetVal });
					}
				} else if (targetMode === Characteristic.TargetHeatingCoolingState.AUTO) {
					const heatProp = this.config.heaterTempProperty;
					const coolProp = this.config.coolerTempProperty;
					const heatRaw = heatProp ? this.values.get(heatProp.id) : null;
					const coolRaw = coolProp ? this.values.get(coolProp.id) : null;
					const currentHeat = heatRaw !== null && heatRaw !== undefined ? Number(heatRaw) : NaN;
					const currentCool = coolRaw !== null && coolRaw !== undefined ? Number(coolRaw) : NaN;
					const span = !isNaN(currentHeat) && !isNaN(currentCool) ? Math.max(0, currentCool - currentHeat) / 2 : 1;

					if (heatProp && this.isPropertyWritable(heatProp)) {
						commands.push({ propertyId: heatProp.id, value: targetVal - span });
					}
					if (coolProp && this.isPropertyWritable(coolProp)) {
						commands.push({ propertyId: coolProp.id, value: targetVal + span });
					}
				} else {
					// OFF: update whichever is writable
					if (this.config.heaterTempProperty && this.isPropertyWritable(this.config.heaterTempProperty)) {
						commands.push({ propertyId: this.config.heaterTempProperty.id, value: targetVal });
					} else if (this.config.coolerTempProperty && this.isPropertyWritable(this.config.coolerTempProperty)) {
						commands.push({ propertyId: this.config.coolerTempProperty.id, value: targetVal });
					}
				}

				if (commands.length > 0) {
					const targetRevs = new Map<string, number>();
					for (const cmd of commands) {
						const nextRev = (this.revisions.get(cmd.propertyId) ?? 0) + 1;
						this.revisions.set(cmd.propertyId, nextRev);
						targetRevs.set(cmd.propertyId, nextRev);
					}
					await this.config.context.commandDispatcher.dispatchBatch(commands);
					let hadConflict = false;
					for (const cmd of commands) {
						if (this.revisions.get(cmd.propertyId) === targetRevs.get(cmd.propertyId)) {
							this.values.set(cmd.propertyId, cmd.value);
						} else {
							hadConflict = true;
						}
					}
					this.refreshCharacteristics();
					if (hadConflict) {
						process.nextTick(() => this.refreshCharacteristics());
					}
				}
			});
		}

		// CurrentHeatingCoolingState
		this.currentHeatingCoolingChar.onGet(() => this.deriveCurrentHeatingCoolingState());

		// TargetHeatingCoolingState
		this.targetHeatingCoolingChar.onGet(() => this.deriveTargetHeatingCoolingState());
		const hasWritableState =
			(this.config.heaterOnProperty && this.isPropertyWritable(this.config.heaterOnProperty)) ||
			(this.config.coolerOnProperty && this.isPropertyWritable(this.config.coolerOnProperty));

		if (hasWritableState && this.targetHeatingCoolingChar.props.perms.includes(Perms.PAIRED_WRITE)) {
			this.targetHeatingCoolingChar.onSet(async (value: CharacteristicValue) => {
				const targetMode = Number(value);
				const commands: Array<{ propertyId: string; value: unknown }> = [];

				if (targetMode === Characteristic.TargetHeatingCoolingState.OFF) {
					if (this.config.heaterOnProperty && this.isPropertyWritable(this.config.heaterOnProperty)) {
						commands.push({ propertyId: this.config.heaterOnProperty.id, value: false });
					}
					if (this.config.coolerOnProperty && this.isPropertyWritable(this.config.coolerOnProperty)) {
						commands.push({ propertyId: this.config.coolerOnProperty.id, value: false });
					}
				} else if (targetMode === Characteristic.TargetHeatingCoolingState.HEAT) {
					if (this.config.heaterOnProperty && this.isPropertyWritable(this.config.heaterOnProperty)) {
						commands.push({ propertyId: this.config.heaterOnProperty.id, value: true });
					}
					if (this.config.coolerOnProperty && this.isPropertyWritable(this.config.coolerOnProperty)) {
						commands.push({ propertyId: this.config.coolerOnProperty.id, value: false });
					}
				} else if (targetMode === Characteristic.TargetHeatingCoolingState.COOL) {
					if (this.config.heaterOnProperty && this.isPropertyWritable(this.config.heaterOnProperty)) {
						commands.push({ propertyId: this.config.heaterOnProperty.id, value: false });
					}
					if (this.config.coolerOnProperty && this.isPropertyWritable(this.config.coolerOnProperty)) {
						commands.push({ propertyId: this.config.coolerOnProperty.id, value: true });
					}
				} else if (targetMode === Characteristic.TargetHeatingCoolingState.AUTO) {
					if (this.config.heaterOnProperty && this.isPropertyWritable(this.config.heaterOnProperty)) {
						commands.push({ propertyId: this.config.heaterOnProperty.id, value: true });
					}
					if (this.config.coolerOnProperty && this.isPropertyWritable(this.config.coolerOnProperty)) {
						commands.push({ propertyId: this.config.coolerOnProperty.id, value: true });
					}
				}

				if (commands.length > 0) {
					const targetRevs = new Map<string, number>();
					for (const cmd of commands) {
						const nextRev = (this.revisions.get(cmd.propertyId) ?? 0) + 1;
						this.revisions.set(cmd.propertyId, nextRev);
						targetRevs.set(cmd.propertyId, nextRev);
					}
					await this.config.context.commandDispatcher.dispatchBatch(commands);
					let hadConflict = false;
					for (const cmd of commands) {
						if (this.revisions.get(cmd.propertyId) === targetRevs.get(cmd.propertyId)) {
							this.values.set(cmd.propertyId, cmd.value);
						} else {
							hadConflict = true;
						}
					}
					this.refreshCharacteristics();
					if (hadConflict) {
						process.nextTick(() => this.refreshCharacteristics());
					}
				}
			});
		}

		// HeatingThresholdTemperature & CoolingThresholdTemperature (for AUTO mode)
		if (this.heatingThresholdChar && this.config.heaterTempProperty) {
			const heaterTempProp = this.config.heaterTempProperty;
			this.heatingThresholdChar.onGet(() => {
				const val = this.values.get(heaterTempProp.id);
				if (val !== null && val !== undefined) {
					const num = Number(val);
					return !isNaN(num) ? num : 20;
				}
				return 20;
			});
			if (
				this.isPropertyWritable(heaterTempProp) &&
				this.heatingThresholdChar.props.perms.includes(Perms.PAIRED_WRITE)
			) {
				this.heatingThresholdChar.onSet(async (value: CharacteristicValue) => {
					const target = Number(value);
					const targetRev = (this.revisions.get(heaterTempProp.id) ?? 0) + 1;
					this.revisions.set(heaterTempProp.id, targetRev);
					await this.config.context.commandDispatcher.dispatch(heaterTempProp.id, target);
					const hasConflict = this.revisions.get(heaterTempProp.id) !== targetRev;
					if (!hasConflict) {
						this.values.set(heaterTempProp.id, target);
					}
					this.refreshCharacteristics();
					if (hasConflict) {
						process.nextTick(() => this.refreshCharacteristics());
					}
				});
			}
		}

		if (this.coolingThresholdChar && this.config.coolerTempProperty) {
			const coolerTempProp = this.config.coolerTempProperty;
			this.coolingThresholdChar.onGet(() => {
				const val = this.values.get(coolerTempProp.id);
				if (val !== null && val !== undefined) {
					const num = Number(val);
					return !isNaN(num) ? num : 25;
				}
				return 25;
			});
			if (
				this.isPropertyWritable(coolerTempProp) &&
				this.coolingThresholdChar.props.perms.includes(Perms.PAIRED_WRITE)
			) {
				this.coolingThresholdChar.onSet(async (value: CharacteristicValue) => {
					const target = Number(value);
					const targetRev = (this.revisions.get(coolerTempProp.id) ?? 0) + 1;
					this.revisions.set(coolerTempProp.id, targetRev);
					await this.config.context.commandDispatcher.dispatch(coolerTempProp.id, target);
					const hasConflict = this.revisions.get(coolerTempProp.id) !== targetRev;
					if (!hasConflict) {
						this.values.set(coolerTempProp.id, target);
					}
					this.refreshCharacteristics();
					if (hasConflict) {
						process.nextTick(() => this.refreshCharacteristics());
					}
				});
			}
		}

		// Child Lock
		if (this.config.lockedProperty) {
			const lockProp = this.config.lockedProperty;
			this.lockPhysicalControlsChar = this.config.service.getCharacteristic(Characteristic.LockPhysicalControls);
			this.lockPhysicalControlsChar.onGet(() => this.getLockPhysicalControls());

			if (this.isPropertyWritable(lockProp) && this.lockPhysicalControlsChar.props.perms.includes(Perms.PAIRED_WRITE)) {
				this.lockPhysicalControlsChar.onSet(async (value: CharacteristicValue) => {
					const isLocked = value === Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
					const targetRev = (this.revisions.get(lockProp.id) ?? 0) + 1;
					this.revisions.set(lockProp.id, targetRev);
					await this.config.context.commandDispatcher.dispatch(lockProp.id, isLocked);
					const hasConflict = this.revisions.get(lockProp.id) !== targetRev;
					if (!hasConflict) {
						this.values.set(lockProp.id, isLocked);
					}
					this.refreshCharacteristics();
					if (hasConflict) {
						process.nextTick(() => this.refreshCharacteristics());
					}
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
					this.revisions.set(prop.id, (this.revisions.get(prop.id) ?? 0) + 1);
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
			if (val !== null && val !== undefined) {
				const num = Number(val);
				if (!isNaN(num)) {
					this.heatingThresholdChar.updateValue(num);
				}
			}
		}
		if (this.coolingThresholdChar && this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			if (val !== null && val !== undefined) {
				const num = Number(val);
				if (!isNaN(num)) {
					this.coolingThresholdChar.updateValue(num);
				}
			}
		}

		if (this.lockPhysicalControlsChar && this.config.lockedProperty) {
			this.lockPhysicalControlsChar.updateValue(this.getLockPhysicalControls());
		}
	}

	private getLockPhysicalControls(): number {
		if (!this.config.lockedProperty) {
			return Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
		}
		const val = this.values.get(this.config.lockedProperty.id);
		return val === true || val === 'true' || val === 1 || val === 'locked'
			? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
			: Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
	}

	private getAmbientTemperature(): number {
		const val = this.values.get(this.config.ambientTempProperty.id);
		if (val !== null && val !== undefined) {
			const num = Number(val);
			return !isNaN(num) ? num : 20;
		}
		return 20;
	}

	private getTargetTemperature(): number {
		const mode = this.deriveTargetHeatingCoolingState();
		if (mode === Characteristic.TargetHeatingCoolingState.COOL && this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			if (val !== null && val !== undefined) {
				const num = Number(val);
				return !isNaN(num) ? num : 25;
			}
			return 25;
		}
		if (this.config.heaterTempProperty) {
			const val = this.values.get(this.config.heaterTempProperty.id);
			if (val !== null && val !== undefined) {
				const num = Number(val);
				return !isNaN(num) ? num : 20;
			}
			return 20;
		}
		if (this.config.coolerTempProperty) {
			const val = this.values.get(this.config.coolerTempProperty.id);
			if (val !== null && val !== undefined) {
				const num = Number(val);
				return !isNaN(num) ? num : 25;
			}
			return 25;
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
					const targetRaw = this.config.heaterTempProperty ? this.values.get(this.config.heaterTempProperty.id) : null;
					const targetTemp = targetRaw !== null && targetRaw !== undefined ? Number(targetRaw) : NaN;
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
					const targetRaw = this.config.coolerTempProperty ? this.values.get(this.config.coolerTempProperty.id) : null;
					const targetTemp = targetRaw !== null && targetRaw !== undefined ? Number(targetRaw) : NaN;
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
