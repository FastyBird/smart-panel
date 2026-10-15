import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

interface MotorLane {
	epoch: string;
	recovering: boolean;
}
/** Operator recovery fences the same physical effect across aliases and all three motor controls. */
@Injectable()
export class ShellyCoverRecoveryLaneService implements OnModuleInit, OnModuleDestroy {
	private readonly motors = new Map<string, MotorLane>();
	private unregister?: () => void;
	private stopped = false;
	constructor(
		private readonly admission: PropertyCommandAdmissionRegistryService,
		private readonly windows: PropertyCommandWindowService,
	) {}
	private scope(update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): string | null {
		const mac = (update.device as ShellyNgDeviceEntity).canonicalMac;
		return update.device.type === 'devices-shelly-ng' &&
			mac &&
			/^cover:\d+$/.test(update.channel.identifier ?? '') &&
			[PropertyCategory.COMMAND, PropertyCategory.POSITION, PropertyCategory.TILT].includes(update.property.category)
			? `${mac.toUpperCase()}|cover:${Number(update.channel.identifier.split(':')[1])}`
			: null;
	}
	onModuleInit(): void {
		this.unregister = this.admission.register({
			capture: () => {
				const epochs = new Map([...this.motors].map(([scope, state]) => [scope, state.epoch]));
				const current = (update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>) => {
					const scope = this.scope(update);
					return (
						!scope ||
						(!this.stopped &&
							!this.motors.get(scope)?.recovering &&
							epochs.get(scope) === this.motors.get(scope)?.epoch)
					);
				};
				const assert = (update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): Promise<void> => {
					if (!current(update))
						return Promise.reject(new ConflictException('Cover recovery invalidated captured command authority'));
					return Promise.resolve();
				};
				return {
					isCurrent: (update) => !update || current(update),
					isEffectCurrent: current,
					assertAllowed: assert,
					assertEffectAllowed: assert,
				};
			},
			isEffectCurrent: (effect) => !this.motors.get(this.scope(effect))?.recovering,
			assertEffectAllowed: (effect) => this.assertOpen(this.scope(effect)),
			assertAllowed: (update) => this.assertOpen(this.scope(update)),
		});
	}
	private assertOpen(scope: string | null): Promise<void> {
		return scope && this.motors.get(scope)?.recovering
			? Promise.reject(new ConflictException('Cover operator recovery is in progress'))
			: Promise.resolve();
	}
	private state(scope: string): MotorLane {
		let state = this.motors.get(scope);
		if (!state) {
			if (this.motors.size >= 4096) throw new ConflictException('Cover recovery lane capacity exceeded');
			state = { epoch: randomUUID(), recovering: false };
			this.motors.set(scope, state);
		}
		return state;
	}
	prepare(scope: string) {
		// Normal preparation must not advance the admission epoch captured before metadata I/O.
		const state = this.motors.get(scope);
		if (this.stopped || state?.recovering || (!this.preparations.has(scope) && this.preparations.size >= 4096))
			return null;
		const epoch = state?.epoch;
		// Counts are separate from recovery epochs so first preparation cannot invalidate itself.
		this.preparations.set(scope, (this.preparations.get(scope) ?? 0) + 1);
		let disposed = false;
		return {
			isCurrent: () =>
				!disposed && !this.stopped && !this.motors.get(scope)?.recovering && this.motors.get(scope)?.epoch === epoch,
			enter: () => {
				if (disposed || this.stopped || this.motors.get(scope)?.recovering || this.motors.get(scope)?.epoch !== epoch)
					throw new ConflictException('Cover preparation expired');
				this.active.set(scope, (this.active.get(scope) ?? 0) + 1);
				return () => {
					const remaining = (this.active.get(scope) ?? 1) - 1;
					if (remaining > 0) this.active.set(scope, remaining);
					else this.active.delete(scope);
				};
			},
			dispose: () => {
				if (!disposed) {
					disposed = true;
					const remaining = (this.preparations.get(scope) ?? 1) - 1;
					if (remaining > 0) this.preparations.set(scope, remaining);
					else this.preparations.delete(scope);
				}
			},
		};
	}
	isRecovering(scope: string): boolean {
		return this.stopped || this.motors.get(scope)?.recovering === true;
	}
	private readonly preparations = new Map<string, number>();
	private readonly active = new Map<string, number>();
	/** Synchronous before any recovery await: revoke core windows and every captured leaf admission. */
	begin(scope: string, retire?: () => void) {
		if (this.stopped) throw new ConflictException('Cover recovery is shutting down');
		const state = this.state(scope);
		if (state.recovering) throw new ConflictException('Cover recovery already in progress');
		state.epoch = randomUUID();
		const effect = `shelly-ng:${scope}`;
		const handle = this.windows.reserveCoverEffect(effect);
		if (handle === null) throw new ConflictException('Cover effect capacity exceeded');
		try {
			retire?.();
		} catch (error) {
			this.windows.releaseCoverEffectReservation(effect, handle);
			throw error;
		}
		if ((this.preparations.get(scope) ?? 0) > 0 || (this.active.get(scope) ?? 0) > 0) {
			this.windows.releaseCoverEffectReservation(effect, handle);
			throw new ConflictException('Cover has active or prepared local dispatch; retry after it settles');
		}
		state.recovering = true;
		const epoch = state.epoch;
		return {
			epoch,
			isCurrent: () => state.recovering && state.epoch === epoch && this.windows.isCoverEffectCurrent(effect, handle),
			dispose: () => {
				if (state.epoch === epoch) {
					state.epoch = randomUUID();
					state.recovering = false;
				}
				this.windows.releaseCoverEffectReservation(effect, handle);
			},
		};
	}
	onModuleDestroy(): void {
		this.stopped = true;
		this.unregister?.();
		for (const state of this.motors.values()) {
			state.epoch = randomUUID();
			state.recovering = true;
		}
	}
}
