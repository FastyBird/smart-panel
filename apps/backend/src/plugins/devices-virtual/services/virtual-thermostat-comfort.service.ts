import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource } from 'typeorm';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { thermostatComfortSelection } from './thermostat-comfort-selection';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
	ThermostatSetpoints,
	effectiveThermostatComfort,
	validateThermostatComfort,
} from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';

export interface ThermostatComfortFence {
	expected_revision: number;
	expected_graph_revision: number;
}

/** Absolute persisted lifetime plus a bounded process-local budget; uncertain recovery inhibits demand. */
@Injectable()
export class VirtualThermostatComfortService {
	private readonly logger = new Logger(VirtualThermostatComfortService.name);
	private readonly leases = new Map<
		string,
		{ id: string; revision: number; deadline: number; watermark: number; status: 'expired' | 'clock_uncertain' | null }
	>();
	private readonly pendingNotifications = new Set<string>();
	constructor(
		private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
	) {}

	/** Never registers a lease from a snapshot. Stale snapshots cannot recreate discarded identities. */
	isCurrent(row: Pick<VirtualThermostatConfigEntity, 'controllerId' | 'revision' | 'comfort'>): boolean {
		const override = row.comfort?.temporary_override;
		if (override?.status === 'clock_uncertain') return false;
		if (override?.status !== 'active') return true;
		const lease = this.leases.get(row.controllerId);
		if (!lease || lease.id !== override.id || lease.revision !== row.revision) return false;
		if (!lease.status) {
			const now = Date.now(),
				monotonic = performance.now();
			lease.status =
				!Number.isFinite(now) || !Number.isFinite(monotonic)
					? 'clock_uncertain'
					: now >= Date.parse(override.expires_at) || monotonic >= lease.deadline
						? 'expired'
						: now < lease.watermark
							? 'clock_uncertain'
							: null;
			if (!lease.status) lease.watermark = Math.max(lease.watermark, now);
		}
		return !lease.status;
	}

	/** Only committed settlement makes expiry durable. A sync dispatch refusal cannot promise crash durability. */
	async settle(controllerId: string): Promise<void> {
		const settled = await this.structure.runShared(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (row?.comfort?.temporary_override?.status === 'active' || this.pendingNotifications.has(controllerId))
				return false;
			this.leases.delete(controllerId);
			return true;
		});
		if (settled) return;
		// Never upgrade a shared lock. Re-read after acquiring exclusive ownership; the override may have changed.
		await this.structure.runExclusive(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			const override = row?.comfort?.temporary_override;
			if (!override || override.status !== 'active') {
				this.leases.delete(controllerId);
				if (this.pendingNotifications.has(controllerId)) await this.changed(controllerId);
				return;
			}
			const now = Date.now(),
				monotonic = performance.now();
			const created = Date.parse(override.created_at),
				expiry = Date.parse(override.expires_at);
			const duration = override.original_duration_ms === undefined ? expiry - created : override.original_duration_ms;
			const watermark = override.wall_watermark_ms === undefined ? created : override.wall_watermark_ms;
			let lease = this.leases.get(controllerId);
			if (!lease || lease.id !== override.id) {
				const valid =
					[now, monotonic, created, expiry, duration, watermark].every(Number.isFinite) &&
					duration > 0 &&
					duration <= 7 * 86400000 &&
					expiry - created === duration &&
					watermark >= created &&
					watermark < expiry;
				lease = {
					id: override.id,
					revision: row.revision,
					deadline: monotonic + Math.max(0, Math.min(duration, expiry - now)),
					watermark,
					status:
						Number.isFinite(now) && Number.isFinite(expiry) && now >= expiry
							? 'expired'
							: !valid || now < watermark
								? 'clock_uncertain'
								: null,
				};
				this.leases.set(controllerId, lease);
			}
			lease.revision = row.revision;
			this.isCurrent(row);
			if (lease.status) {
				await this.graph.withStructuralWrite(async (manager) => {
					const current = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
					if (current.revision !== row.revision || current.comfort?.temporary_override?.id !== override.id)
						throw new DevicesValidationException('Thermostat revision changed during expiry settlement.');
					current.comfort.temporary_override.status = lease.status;
					current.comfort.temporary_override.terminated_at = Number.isFinite(now) ? new Date(now).toISOString() : null;
					current.revision++;
					await manager.save(current);
				});
				this.leases.delete(controllerId);
				await this.changed(controllerId);
			} else {
				// Persist every observed watermark: batching would weaken rollback detection after a crash/restart.
				// This is evidence only, not an intent revision, expiry renewal or sample refresh.
				lease.watermark = Math.max(lease.watermark, now);
				if (override.wall_watermark_ms !== lease.watermark) {
					override.wall_watermark_ms = lease.watermark;
					await this.database.transaction(async (manager) => {
						const updated = await manager.update(
							VirtualThermostatConfigEntity,
							{ controllerId, revision: row.revision },
							{ comfort: row.comfort },
						);
						if (updated.affected !== 1)
							throw new DevicesValidationException('Thermostat revision changed during watermark settlement.');
					});
				}
				if (this.pendingNotifications.has(controllerId)) await this.changed(controllerId);
			}
		});
	}

	async get(controllerId: string, settle = (id: string) => this.settle(id)) {
		await settle(controllerId);
		return this.structure.runShared(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
			return {
				controller: controllerId,
				revision: row.revision,
				graph_revision: await this.graph.revision(),
				configuration: row.comfort,
				effective: effectiveThermostatComfort(row.policy, row.comfort),
				clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit' as const,
			};
		});
	}

	async configure(
		id: string,
		fence: ThermostatComfortFence,
		input: Pick<ThermostatComfortConfiguration, 'heating_range' | 'cooling_range' | 'presets'> & {
			automation_enabled?: boolean;
		},
	) {
		return this.runComfortIntent('definition', id, fence, input);
	}

	async select(
		id: string,
		fence: ThermostatComfortFence,
		preset: ThermostatPreset | null,
		clearUserOff: boolean,
	): Promise<Awaited<ReturnType<VirtualThermostatComfortService['get']>>> {
		return this.runComfortIntent('selection', id, fence, preset, clearUserOff);
	}

	/** Trusted bridge port only: no public DTO or route accepts an automation source/actor. */
	async applyAutomationBaseline(
		id: string,
		fence: ThermostatComfortFence,
		selection: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null } | null,
		actorId: string,
	) {
		return this.mutate(id, fence, (row) => {
			if (!row.comfort?.automation_enabled || !actorId)
				throw new DevicesValidationException(
					'Thermostat automation is not explicitly enabled or its actor is missing.',
				);
			row.comfort.automation_baseline = selection
				? { ...selection, actor_id: actorId, revision: row.revision + 1 }
				: null;
		});
	}

	async override(
		id: string,
		fence: ThermostatComfortFence,
		input: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null; expires_at: string },
		actorId: string,
		source: 'user' | 'panel' = 'user',
	) {
		let identity: string;
		let deadline: number;
		let watermark: number;
		return this.mutate(
			id,
			fence,
			(row) => {
				if (!row.comfort) throw new DevicesValidationException('Configure explicit comfort ranges and presets first.');
				const now = Date.now();
				const duration = Date.parse(input.expires_at) - now;
				if (
					!actorId ||
					typeof input.expires_at !== 'string' ||
					!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(input.expires_at) ||
					!Number.isFinite(duration) ||
					duration <= 0 ||
					duration > 7 * 86400000
				)
					throw new DevicesValidationException(
						'Override needs an identified actor and a future expiry within seven days.',
					);
				const resolved = input.preset
					? row.comfort.presets.find((entry) => entry.preset === input.preset)?.setpoints
					: input.setpoints;
				if (!resolved) throw new DevicesValidationException('Override preset or setpoints are missing.');
				identity = randomUUID();
				deadline = performance.now() + duration;
				watermark = now;
				row.comfort.temporary_override = {
					...input,
					id: identity,
					source,
					actor_id: actorId,
					revision: row.revision + 1,
					original_duration_ms: duration,
					wall_watermark_ms: now,
					created_at: new Date(now).toISOString(),
					expires_at: new Date(now + duration).toISOString(),
					resolved_setpoints: { ...resolved },
					status: 'active',
					terminated_at: null,
				};
			},
			() =>
				this.leases.set(id, { id: identity, revision: fence.expected_revision + 1, deadline, watermark, status: null }),
		);
	}

	async cancel(id: string, fence: ThermostatComfortFence, overrideId: string) {
		return this.mutate(
			id,
			fence,
			(row) => {
				const override = row.comfort?.temporary_override;
				if (override?.id !== overrideId || !['active', 'clock_uncertain'].includes(override.status))
					throw new DevicesValidationException('Override identity/state changed; reload before cancelling.');
				override.status = 'cancelled';
				override.terminated_at = new Date().toISOString();
			},
			() => this.leases.delete(id),
		);
	}

	private async runComfortIntent(
		kind: 'selection' | 'definition',
		id: string,
		fence: ThermostatComfortFence,
		value:
			| Parameters<ReturnType<typeof thermostatComfortSelection.pin>['definitionInput']>[2]
			| ThermostatPreset
			| null,
		clearUserOff?: boolean,
	): Promise<Awaited<ReturnType<VirtualThermostatComfortService['get']>>> {
		// Service admission starts here; the controller already extracted its fields; nested inputs are still caller-owned.
		const own = captureCreation(this, [
			'runComfortIntent',
			'database',
			'structure',
			'graph',
			'claims',
			'events',
			'leases',
			'pendingNotifications',
			'logger',
			'settle',
			'get',
			'changed',
			'isCurrent',
		] as (keyof this)[]);
		const lock = captureCreation(this.structure, [
			'runExclusive',
			'runShared',
			'hasCurrentStructuralLease',
			'context',
		] as (keyof DeviceStructureLockService)[]);
		const graph = captureCreation(this.graph, [
			'withComfortSelectionWrite',
			'structuralWrite',
			'refreshValidation',
			'dataSource',
			'revision',
		] as (keyof VirtualDependencyGraphService)[]);
		const claims = captureCreation(this.claims, ['invalidate', 'refresh']);
		const events = captureCreation(this.events, ['emit']);
		const helper = captureCreation(thermostatComfortSelection, ['pin']);
		const selection = helper.values.pin(this.database);
		const pins = [own, lock, graph, claims, events, helper, selection];
		const current = () => pins.every((pin) => pin.current());
		const check = () => {
			if (!current()) throw new DevicesValidationException('Original thermostat selection dispatch expired.');
		};
		const settle = Reflect.get(own.values, 'settle') as VirtualThermostatComfortService['settle'];
		const get = Reflect.get(own.values, 'get') as VirtualThermostatComfortService['get'];
		const changed = Reflect.get(own.values, 'changed') as VirtualThermostatComfortService['changed'];
		const notifications = {
			invalidate: () => claims.values.invalidate.call(claims.receiver),
			refresh: () => claims.values.refresh.call(claims.receiver),
			emit: () => events.values.emit.call(events.receiver, THERMOSTAT_CONFIG_CHANGED, id),
		};
		if (kind !== 'selection' && kind !== 'definition')
			throw new DevicesValidationException('Invalid thermostat comfort intent kind.');
		const input =
			kind === 'selection'
				? selection.input(id, fence, value as ThermostatPreset | null, clearUserOff)
				: selection.definitionInput(id, fence, value as Parameters<typeof selection.definitionInput>[2]);
		check();
		let ownerCurrent = () => false;
		const operation = selection.operation(input, () => ownerCurrent(), current);
		try {
			// Independent maintenance may commit and make the comfort intent fence stale.
			await invokeCreation(settle, own.receiver, input.id);
		} catch (cause: unknown) {
			operation.settlement.preSettleFailure = Object.freeze({ cause });
			throw cause;
		}
		try {
			await lock.values.runExclusive.call(lock.receiver, async () => {
				check();
				// Bind the ORIGINAL async owner for the native callback, never a fresh ambient lookup.
				ownerCurrent = AsyncLocalStorage.bind(() => lock.values.hasCurrentStructuralLease.call(lock.receiver));
				await graph.values.withComfortSelectionWrite.call(
					graph.receiver,
					operation.write,
					input.expected_graph_revision,
					operation.admit,
					operation.accepted,
				);
				operation.accepted();
				// New admission proof expiry cannot discard the inherited post-ACK work.
				await invokeCreation(changed, own.receiver, input.id, notifications);
			});
		} catch (cause: unknown) {
			operation.settlement.transactionFailure = Object.freeze({ cause });
			throw cause;
		}
		try {
			// Keep the old release boundary and exactly one final get for leases, clocks and retries.
			// Its successful latest data is deliberately discarded, including a later writer's intent.
			await invokeCreation(get, own.receiver, input.id, (id) => invokeCreation(settle, own.receiver, id));
		} catch (cause: unknown) {
			operation.settlement.finalGetFailure = Object.freeze({ cause });
			throw cause;
		}
		return operation.copy();
	}

	private async mutate(
		id: string,
		fence: ThermostatComfortFence,
		change: (row: VirtualThermostatConfigEntity) => void,
		afterCommit?: () => void,
	) {
		await this.settle(id);
		await this.structure.runExclusive(async () => {
			await this.graph.withStructuralWrite(async (manager) => {
				const row = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: id });
				if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
				const owner = await manager.findOneBy(VirtualDeviceEntity, { id });
				if (!owner || row.locked || row.revision !== fence.expected_revision)
					throw new DevicesValidationException('Thermostat is missing, locked or its revision changed.');
				change(row);
				const errors = validateThermostatComfort(row.comfort, row.policy);
				if (errors.length) throw new DevicesValidationException(errors.join(', '));
				row.revision++;
				await manager.save(row);
			}, fence.expected_graph_revision);
			afterCommit?.();
			await this.changed(id);
		});
		return this.get(id);
	}

	private async changed(
		id: string,
		dispatch = {
			invalidate: () => this.claims.invalidate(),
			refresh: () => this.claims.refresh(),
			emit: () => this.events.emit(THERMOSTAT_CONFIG_CHANGED, id),
		},
	): Promise<void> {
		// Admission revocation is fail-closed. Publication/refresh after COMMIT cannot undo or replay the mutation.
		dispatch.invalidate();
		let failed = false;
		try {
			await dispatch.refresh();
		} catch (error) {
			failed = true;
			this.logger.error('Comfort committed; claim reconciliation awaits retry.', error);
		}
		try {
			dispatch.emit();
		} catch (error) {
			failed = true;
			this.logger.error('Comfort committed; notification awaits retry.', error);
		}
		if (failed) this.pendingNotifications.add(id);
		else this.pendingNotifications.delete(id);
	}
}
