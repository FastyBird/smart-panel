import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource } from 'typeorm';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import {
	ThermostatComfortConfiguration,
	ThermostatComfortOverride,
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
		}
		if (!lease.status) lease.watermark = Math.max(lease.watermark, Date.now());
		return !lease.status;
	}

	/** Only committed settlement makes expiry durable. A sync dispatch refusal cannot promise crash durability. */
	async settle(controllerId: string): Promise<void> {
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
			const duration = override.original_duration_ms ?? expiry - created;
			const watermark = override.wall_watermark_ms ?? created;
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
				// Watermark is evidence only, not an intent revision, expiry renewal or sample refresh.
				lease.watermark = Math.max(lease.watermark, now);
				if (override.wall_watermark_ms !== lease.watermark) {
					override.wall_watermark_ms = lease.watermark;
					await this.database.transaction(async (manager) => {
						await manager.update(
							VirtualThermostatConfigEntity,
							{ controllerId, revision: row.revision },
							{ comfort: row.comfort },
						);
					});
				}
				if (this.pendingNotifications.has(controllerId)) await this.changed(controllerId);
			}
		});
	}

	async get(controllerId: string) {
		await this.settle(controllerId);
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
		return this.mutate(id, fence, (row) => {
			row.comfort = {
				...input,
				selected_preset: row.comfort?.selected_preset ?? null,
				user_off: row.comfort?.user_off ?? row.requestedMode === 'off',
				automation_enabled: input.automation_enabled ?? row.comfort?.automation_enabled ?? false,
				automation_baseline: input.automation_enabled === false ? null : (row.comfort?.automation_baseline ?? null),
				temporary_override: row.comfort?.temporary_override ?? null,
			};
		});
	}

	async select(id: string, fence: ThermostatComfortFence, preset: ThermostatPreset | null, clearUserOff: boolean) {
		return this.mutate(id, fence, (row) => {
			if (!row.comfort) throw new DevicesValidationException('Configure explicit comfort ranges and presets first.');
			row.comfort.selected_preset = preset;
			if (clearUserOff) row.comfort.user_off = false;
		});
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
					source: 'user',
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

	private async changed(id: string): Promise<void> {
		// Admission revocation is fail-closed. Publication/refresh after COMMIT cannot undo or replay the mutation.
		this.claims.invalidate();
		let failed = false;
		try {
			await this.claims.refresh();
		} catch (error) {
			failed = true;
			this.logger.error('Comfort committed; claim reconciliation awaits retry.', error);
		}
		try {
			this.events.emit(THERMOSTAT_CONFIG_CHANGED, id);
		} catch (error) {
			failed = true;
			this.logger.error('Comfort committed; notification awaits retry.', error);
		}
		if (failed) this.pendingNotifications.add(id);
		else this.pendingNotifications.delete(id);
	}
}
