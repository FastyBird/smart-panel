import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource } from 'typeorm';

import { Injectable, NotFoundException } from '@nestjs/common';
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

/** No cross-downtime trusted clock exists here. Unknown lifetimes terminate rather than silently extend. */
@Injectable()
export class VirtualThermostatComfortService {
	private readonly deadlines = new Map<string, number>();
	private readonly terminal = new Map<string, ThermostatComfortOverride['status']>();
	constructor(
		private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
	) {}

	/** Synchronous final-dispatch fence: an elapsed/unknown override may never fall through using stale settings. */
	isCurrent(comfort: ThermostatComfortConfiguration | null | undefined): boolean {
		const override = comfort?.temporary_override;
		if (override?.status !== 'active') return true;
		if (this.terminal.has(override.id)) return false;
		const deadline = this.deadlines.get(override.id);
		const now = Date.now();
		const expiry = Date.parse(override.expires_at);
		const status =
			deadline === undefined || !Number.isFinite(now) || !Number.isFinite(expiry)
				? 'clock_uncertain'
				: now >= expiry || performance.now() >= deadline
					? 'expired'
					: null;
		if (status) this.terminal.set(override.id, status);
		return !status;
	}

	/** Called before runtime snapshot loading and HTTP reads. Durable terminal state precedes baseline evaluation. */
	async settle(controllerId: string): Promise<void> {
		await this.structure.runExclusive(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!row?.comfort || this.isCurrent(row.comfort)) return;
			await this.graph.withStructuralWrite(async (manager) => {
				const current = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				if (!current.comfort || this.isCurrent(current.comfort)) return;
				current.comfort.temporary_override.status = this.terminal.get(current.comfort.temporary_override.id);
				current.comfort.temporary_override.terminated_at = new Date().toISOString();
				current.revision++;
				await manager.save(current);
			});
			await this.changed(controllerId);
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
				clock_policy: 'terminate_on_restart_uncertainty' as const,
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
				row.comfort.temporary_override = {
					...input,
					id: identity,
					source: 'user',
					actor_id: actorId,
					revision: row.revision + 1,
					created_at: new Date(now).toISOString(),
					expires_at: new Date(now + duration).toISOString(),
					resolved_setpoints: { ...resolved },
					status: 'active',
					terminated_at: null,
				};
			},
			() => this.deadlines.set(identity, deadline),
		);
	}

	async cancel(id: string, fence: ThermostatComfortFence, overrideId: string) {
		return this.mutate(id, fence, (row) => {
			const override = row.comfort?.temporary_override;
			if (override?.id !== overrideId || override.status !== 'active')
				throw new DevicesValidationException('Override identity/state changed; reload before cancelling.');
			override.status = 'cancelled';
			override.terminated_at = new Date().toISOString();
		});
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
		this.claims.invalidate();
		await this.claims.refresh().catch(() => undefined);
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, id);
	}
}
