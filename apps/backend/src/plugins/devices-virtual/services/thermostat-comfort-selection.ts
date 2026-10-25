import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { NotFoundException } from '@nestjs/common';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { canonical, ownedJson } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import type { ThermostatComfortFence } from './virtual-thermostat-comfort.service';
import {
	ThermostatComfortConfiguration,
	ThermostatEffectiveComfort,
	ThermostatPreset,
	ThermostatSetpoints,
	effectiveThermostatComfort,
	validateThermostatComfort,
} from './virtual-thermostat-comfort.utils';

interface SelectionInput extends ThermostatComfortFence {
	readonly kind: 'selection';
	readonly id: string;
	readonly preset: ThermostatPreset | null;
	readonly clearUserOff: boolean;
}
type Definition = Pick<ThermostatComfortConfiguration, 'heating_range' | 'cooling_range' | 'presets'> & {
	automation_enabled?: boolean | null;
};
interface DefinitionInput extends ThermostatComfortFence {
	readonly kind: 'definition';
	readonly id: string;
	readonly definition: Pick<Definition, 'heating_range' | 'cooling_range' | 'presets'> & {
		readonly automation: 'preserve' | 'enable' | 'disable';
	};
}
type Override = { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null; expires_at: string };
interface OverrideInput extends ThermostatComfortFence {
	readonly kind: 'override';
	readonly id: string;
	readonly override: Override;
	readonly actorId: string;
	readonly source: 'user' | 'panel';
}
interface CancelInput extends ThermostatComfortFence {
	readonly kind: 'cancel';
	readonly id: string;
	readonly overrideId: string;
}
type ComfortInput = SelectionInput | DefinitionInput | OverrideInput | CancelInput;
interface Lease {
	id: string;
	revision: number;
	deadline: number;
	watermark: number;
	status: 'expired' | 'clock_uncertain' | null;
}

interface SelectionResult {
	controller: string;
	revision: number;
	graph_revision: number;
	configuration: ThermostatComfortConfiguration;
	effective: ThermostatEffectiveComfort;
	clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit';
}
interface PhysicalDriver {
	connection: DataSource;
	databaseConnection: { all: (...args: unknown[]) => unknown };
	createQueryRunner: () => QueryRunner;
}

function refuse(message = 'Original thermostat selection admission expired'): never {
	throw new DevicesValidationException(message);
}
function revision(value: number, minimum: number, capacity = false): boolean {
	return Number.isSafeInteger(value) && value >= minimum && (!capacity || value < Number.MAX_SAFE_INTEGER);
}

/** Closed comfort intents only. Receipt/result presence survives transaction, release and final-read errors. */
export class ThermostatSelectionSettlement {
	receipt?: SqliteCommitGuardReceipt;
	result?: Readonly<{ value: SelectionResult }>;
	preSettleFailure?: Readonly<{ cause: unknown }>;
	transactionFailure?: Readonly<{ cause: unknown }>;
	finalGetFailure?: Readonly<{ cause: unknown }>;
	localAction?: Readonly<{
		stage: 'checking' | 'installing' | 'deleting' | 'installed' | 'deleted' | 'superseded' | 'no-target';
	}>;
	localFailure?: Readonly<{ cause: unknown }>;
	get outcome() {
		return this.receipt?.outcome ?? 'not_started';
	}
}

/** Capture before service fence getters. No caller supplies a manager, change callback or result. */
function pin(database: DataSource, kind: ComfortInput['kind'] = 'selection', leases?: Map<string, Lease>) {
	const serialize = canonical;
	const detach = ownedJson;
	const validate = validateThermostatComfort;
	const effective = effectiveThermostatComfort;
	const observe = observeSqliteOuterOutcome;
	const guard = registerSqliteCommitGuard;
	if (!(database instanceof SqliteDataSource) || !database.isInitialized) refuse();
	const source = captureCreation(database, ['manager', 'driver', 'transaction', 'isInitialized', 'createQueryRunner']);
	const root = captureCreation(source.values.manager, ['connection', 'queryRunner', 'query', 'createQueryBuilder']);
	const driver = captureCreation(source.values.driver as unknown as PhysicalDriver, [
		'connection',
		'databaseConnection',
		'createQueryRunner',
	]);
	const physical = driver.values.databaseConnection;
	if (
		!physical ||
		typeof physical !== 'object' ||
		root.values.connection !== database ||
		root.values.queryRunner !== undefined ||
		driver.values.connection !== database
	)
		refuse();
	const native = captureCreation(physical, ['all']);
	// Only the two lifetime operations admit these dispatches. No clock values are sampled here.
	const dated = kind === 'override' || kind === 'cancel';
	const dateGlobal = dated ? captureCreation(globalThis, ['Date']) : undefined;
	const date = dated
		? captureCreation(
				dateGlobal.values.Date as unknown as DateConstructor,
				kind === 'override' ? ['now', 'parse', 'prototype'] : ['prototype'],
			)
		: undefined;
	const iso = dated ? captureCreation(date.values.prototype, ['toISOString']) : undefined;
	const monotonic = kind === 'override' ? captureCreation(performance, ['now']) : undefined;
	const uuid = kind === 'override' ? captureCreation(crypto, ['randomUUID']) : undefined;
	const local =
		dated && leases instanceof Map
			? captureCreation(leases, kind === 'override' ? ['get', 'set'] : ['get', 'delete'])
			: undefined;
	if (
		dated &&
		(!local ||
			typeof local.values.get !== 'function' ||
			(kind === 'override' ? typeof local.values.set !== 'function' : typeof local.values.delete !== 'function') ||
			typeof dateGlobal.values.Date !== 'function' ||
			typeof iso.values.toISOString !== 'function' ||
			(kind === 'override' &&
				(typeof date.values.now !== 'function' ||
					typeof date.values.parse !== 'function' ||
					typeof monotonic.values.now !== 'function' ||
					typeof uuid.values.randomUUID !== 'function')))
	)
		refuse();
	const lifetimePins = [dateGlobal, date, iso, monotonic, uuid, local].filter((pin) => pin !== undefined);
	const current = () =>
		source.current() &&
		root.current() &&
		driver.current() &&
		native.current() &&
		database.isInitialized &&
		lifetimePins.every((pin) => pin.current());
	const check = () => {
		if (!current()) refuse();
	};
	// DTO prototypes and own undefined are ordinary inputs. Read only this finite schema,
	// caching by object AND field so aliases (including fence/definition aliases) read once.
	const reader = () => {
		const cache = new Map<object, Map<string, unknown>>();
		return (object: unknown, field: string): unknown => {
			if (!object || typeof object !== 'object') refuse('Invalid thermostat definition structure.');
			let fields = cache.get(object);
			if (!fields) cache.set(object, (fields = new Map<string, unknown>()));
			if (!fields.has(field)) fields.set(field, Reflect.get(object, field));
			return fields.get(field);
		};
	};
	const record = (value: unknown): object => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('Invalid thermostat definition structure.');
		return value;
	};
	const fences = (id: string, fence: ThermostatComfortFence, read: ReturnType<typeof reader>) => {
		record(fence);
		const expected_revision = read(fence, 'expected_revision');
		const expected_graph_revision = read(fence, 'expected_graph_revision');
		if (
			typeof id !== 'string' ||
			!id ||
			typeof expected_revision !== 'number' ||
			!revision(expected_revision, 1) ||
			typeof expected_graph_revision !== 'number' ||
			!revision(expected_graph_revision, 0)
		)
			refuse('Invalid thermostat selection or revision fences.');
		return { expected_revision, expected_graph_revision };
	};
	return Object.freeze({
		current,
		input(id: string, fence: ThermostatComfortFence, preset: ThermostatPreset | null, clearUserOff: boolean) {
			const input: SelectionInput = Object.freeze({
				kind: 'selection',
				id,
				...fences(id, fence, reader()),
				preset,
				clearUserOff,
			});
			check();
			if ((preset !== null && !['comfort', 'eco', 'away'].includes(preset)) || typeof clearUserOff !== 'boolean')
				refuse('Invalid thermostat selection or revision fences.');
			return input;
		},
		definitionInput(id: string, fence: ThermostatComfortFence, definition: Definition): DefinitionInput {
			record(definition);
			const read = reader();
			const capturedFence = fences(id, fence, read);
			const number = (value: unknown): number => {
				if (typeof value !== 'number' || !Number.isFinite(value)) refuse('Invalid thermostat definition number.');
				return value;
			};
			const range = (value: unknown) =>
				value === null
					? null
					: {
							minimum: number(read(record(value), 'minimum')),
							maximum: number(read(value, 'maximum')),
						};
			const heating_range = range(read(definition, 'heating_range'));
			const cooling_range = range(read(definition, 'cooling_range'));
			const entries = read(definition, 'presets');
			if (!Array.isArray(entries)) refuse('Invalid thermostat definition presets.');
			const length = read(entries, 'length');
			if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 3)
				refuse('Invalid thermostat definition presets.');
			const presets: ThermostatComfortConfiguration['presets'] = [];
			for (let index = 0; index < length; index++) {
				if (!Object.hasOwn(entries, index)) refuse('Invalid thermostat definition preset entry.');
				const entry = record(read(entries, String(index)));
				const preset = read(entry, 'preset');
				if (preset !== 'comfort' && preset !== 'eco' && preset !== 'away')
					refuse('Invalid thermostat definition preset.');
				const setpoints = record(read(entry, 'setpoints'));
				const heating = read(setpoints, 'heating_setpoint');
				const cooling = read(setpoints, 'cooling_setpoint');
				presets.push({
					preset,
					setpoints: {
						heating_setpoint: heating === null ? null : number(heating),
						cooling_setpoint: cooling === null ? null : number(cooling),
					},
				});
			}
			const enabled = read(definition, 'automation_enabled');
			if (enabled !== undefined && enabled !== null && typeof enabled !== 'boolean')
				refuse('Invalid thermostat automation flag.');
			const automation = enabled === true ? 'enable' : enabled === false ? 'disable' : 'preserve';
			const payload = detach({
				heating_range,
				cooling_range,
				presets,
				automation,
			}) as unknown as DefinitionInput['definition'];
			check();
			return Object.freeze({ kind: 'definition', id, ...capturedFence, definition: payload });
		},
		overrideInput(
			id: string,
			fence: ThermostatComfortFence,
			input: Override,
			actorId: string,
			source: 'user' | 'panel',
		): OverrideInput {
			const read = reader();
			const capturedFence = fences(id, fence, read);
			record(input);
			const preset = read(input, 'preset');
			const supplied = read(input, 'setpoints');
			const expires_at = read(input, 'expires_at');
			if (
				(preset !== null && preset !== 'comfort' && preset !== 'eco' && preset !== 'away') ||
				typeof expires_at !== 'string' ||
				typeof actorId !== 'string' ||
				!actorId ||
				(source !== 'user' && source !== 'panel')
			)
				refuse('Override needs an identified actor and a future expiry within seven days.');
			let setpoints: ThermostatSetpoints | null = null;
			if (supplied !== null) {
				record(supplied);
				const heating = read(supplied, 'heating_setpoint'),
					cooling = read(supplied, 'cooling_setpoint');
				if (
					(heating !== null && (typeof heating !== 'number' || !Number.isFinite(heating))) ||
					(cooling !== null && (typeof cooling !== 'number' || !Number.isFinite(cooling)))
				)
					refuse('unsupported_branch_or_setpoint_range');
				setpoints = { heating_setpoint: heating as number | null, cooling_setpoint: cooling as number | null };
			}
			const payload = detach({ preset, setpoints, expires_at }) as unknown as Override;
			check();
			return Object.freeze({ kind: 'override', id, ...capturedFence, override: payload, actorId, source });
		},
		cancelInput(id: string, fence: ThermostatComfortFence, overrideId: string): CancelInput {
			const capturedFence = fences(id, fence, reader());
			if (typeof overrideId !== 'string' || !overrideId)
				refuse('Override identity/state changed; reload before cancelling.');
			check();
			return Object.freeze({ kind: 'cancel', id, ...capturedFence, overrideId });
		},
		operation(input: ComfortInput, ownerCurrent: () => boolean, dispatchCurrent: () => boolean) {
			if (
				!['selection', 'definition', 'override', 'cancel'].includes(input.kind) ||
				((input.kind === 'override' || input.kind === 'cancel') && (input.kind !== kind || !local))
			)
				refuse('Invalid thermostat comfort intent kind.');
			const settlement = new ThermostatSelectionSettlement();
			let ready = false;
			let slot:
				| Readonly<{ reference: Lease | undefined; id: string | undefined; revision: number | undefined }>
				| undefined;
			let plan:
				| Readonly<{ controller: string; id: string; revision: number; deadline: number; watermark: number }>
				| undefined;
			let original: EntityManager | undefined;
			let scopedCurrent: (() => boolean) | undefined;
			const valid = () => current() && dispatchCurrent() && scopedCurrent?.() === true && ownerCurrent();
			const assert = () => {
				if (!valid()) refuse();
			};
			return Object.freeze({
				settlement,
				captureSlot(): void {
					if (input.kind !== 'override' && input.kind !== 'cancel') return;
					const reference = local.values.get.call(local.receiver, input.id);
					slot = Object.freeze({ reference, id: reference?.id, revision: reference?.revision });
				},
				localAction(): void {
					if (input.kind !== 'override' && input.kind !== 'cancel') return;
					// No post-ACK admission gate. A superseded destination skips only this initial action.
					try {
						settlement.localAction = Object.freeze({ stage: 'checking' });
						if (!slot || settlement.outcome !== 'committed' || !settlement.result) refuse();
						const current = local.values.get.call(local.receiver, input.id);
						if (current !== slot.reference || current?.id !== slot.id || current?.revision !== slot.revision) {
							settlement.localAction = Object.freeze({ stage: 'superseded' });
						} else if (input.kind === 'override') {
							if (!plan) refuse();
							settlement.localAction = Object.freeze({ stage: 'installing' });
							// The immutable private plan is not the mutable lease used by isCurrent/settle.
							local.values.set.call(local.receiver, plan.controller, {
								id: plan.id,
								revision: plan.revision,
								deadline: plan.deadline,
								watermark: plan.watermark,
								status: null,
							});
							settlement.localAction = Object.freeze({ stage: 'installed' });
						} else if (current && slot.id === input.overrideId) {
							settlement.localAction = Object.freeze({ stage: 'deleting' });
							local.values.delete.call(local.receiver, input.id);
							settlement.localAction = Object.freeze({ stage: 'deleted' });
						} else settlement.localAction = Object.freeze({ stage: 'no-target' });
					} catch (cause: unknown) {
						// Dispatch may have partially acted; retain phase/cause, never compensate or replay.
						settlement.localFailure = Object.freeze({ cause });
						throw cause;
					}
				},
				admit(manager: EntityManager): void {
					// FIRST: a foreign manager or nested savepoint cannot create an outer success receipt.
					const receipt = observe(manager);
					if (original) refuse();
					settlement.receipt = receipt;
					original = manager;
					const selected = captureCreation(manager, ['connection', 'queryRunner', 'createQueryBuilder', 'query']);
					const runner = manager.queryRunner;
					if (!runner) refuse();
					const runnerPin = captureCreation(runner as QueryRunner & { driver: PhysicalDriver }, [
						'manager',
						'connection',
						'driver',
						'query',
						'connect',
						'commitTransaction',
						'release',
					]);
					scopedCurrent = () =>
						selected.current() &&
						runnerPin.current() &&
						selected.values.connection === database &&
						selected.values.queryRunner === runner &&
						runnerPin.values.driver === driver.receiver &&
						runner.manager === manager &&
						runner.connection === database &&
						runner.isTransactionActive &&
						Reflect.get(runner, 'transactionDepth') === 1 &&
						driver.receiver.databaseConnection === physical;
					// Pure, synchronous, original-owner check. P01 drains its own admitted children.
					guard(manager, () => ready && !!settlement.result && (input.kind !== 'override' || !!plan) && valid());
					assert();
				},
				async write(manager: EntityManager): Promise<SelectionResult> {
					assert();
					if (manager !== original) refuse();
					const row = await manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOne();
					assert();
					if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
					const owner = await manager
						.createQueryBuilder(VirtualDeviceEntity, 'owner')
						.select(['owner.id'])
						.where('owner.id = :id', { id: input.id })
						.callListeners(false)
						.getOne();
					assert();
					if (
						!owner ||
						owner.id !== input.id ||
						row.ownerDeviceId !== owner.id ||
						row.locked ||
						row.revision !== input.expected_revision ||
						!revision(row.revision, 1, true)
					)
						refuse('Thermostat is missing, detached, locked or its revision changed/overflowed.');
					let intended: ThermostatComfortConfiguration;
					let birth:
						| Readonly<{ controller: string; id: string; revision: number; deadline: number; watermark: number }>
						| undefined;
					if (input.kind === 'selection') {
						if (!row.comfort) refuse('Configure explicit comfort ranges and presets first.');
						intended = JSON.parse(serialize(row.comfort)) as ThermostatComfortConfiguration;
						intended.selected_preset = input.preset;
						if (input.clearUserOff) intended.user_off = false;
					} else if (input.kind === 'definition') {
						const definition = input.definition;
						const old = row.comfort;
						// Exact configure merge, before reserved-policy validation. No new arbitration authority.
						intended = {
							heating_range: definition.heating_range,
							cooling_range: definition.cooling_range,
							presets: definition.presets,
							selected_preset: old?.selected_preset ?? null,
							user_off: old?.user_off ?? row.requestedMode === 'off',
							automation_enabled:
								definition.automation === 'preserve'
									? (old?.automation_enabled ?? false)
									: definition.automation === 'enable',
							automation_baseline: definition.automation === 'disable' ? null : (old?.automation_baseline ?? null),
							temporary_override: old?.temporary_override ?? null,
						};
					} else {
						if (!row.comfort)
							refuse(
								input.kind === 'override'
									? 'Configure explicit comfort ranges and presets first.'
									: 'Override identity/state changed; reload before cancelling.',
							);
						intended = JSON.parse(serialize(row.comfort)) as ThermostatComfortConfiguration;
						const DateConstructor = dateGlobal.values.Date as DateConstructor;
						const utc = (value: Date) => iso.values.toISOString.call(value);
						if (input.kind === 'override') {
							const now = date.values.now.call(date.receiver);
							const duration = date.values.parse.call(date.receiver, input.override.expires_at) - now;
							if (
								!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(input.override.expires_at) ||
								!Number.isFinite(duration) ||
								duration <= 0 ||
								duration > 7 * 86400000
							)
								refuse('Override needs an identified actor and a future expiry within seven days.');
							const resolved = input.override.preset
								? intended.presets.find((entry) => entry.preset === input.override.preset)?.setpoints
								: input.override.setpoints;
							if (!resolved) refuse('Override preset or setpoints are missing.');
							const identity = uuid.values.randomUUID.call(uuid.receiver);
							const initial = monotonic.values.now.call(monotonic.receiver);
							const deadline = initial + duration;
							// Deliberate birth-fault refusal. Later finite samples cannot repair this budget.
							if (!Number.isFinite(initial) || !Number.isFinite(deadline))
								refuse('Override initial clock is not finite.');
							birth = Object.freeze({
								controller: input.id,
								id: identity,
								revision: row.revision + 1,
								deadline,
								watermark: now,
							});
							intended.temporary_override = {
								preset: input.override.preset,
								setpoints: input.override.setpoints,
								id: identity,
								source: input.source,
								actor_id: input.actorId,
								revision: row.revision + 1,
								original_duration_ms: duration,
								wall_watermark_ms: now,
								created_at: utc(new DateConstructor(now)),
								expires_at: utc(new DateConstructor(now + duration)),
								resolved_setpoints: { ...resolved },
								status: 'active',
								terminated_at: null,
							};
						} else {
							const override = intended.temporary_override;
							if (override?.id !== input.overrideId || !['active', 'clock_uncertain'].includes(override.status))
								refuse('Override identity/state changed; reload before cancelling.');
							override.status = 'cancelled';
							override.terminated_at = utc(new DateConstructor());
						}
					}
					const errors = validate(intended, row.policy);
					if (errors.length) refuse(errors.join(', '));
					const intendedJson = serialize(intended);
					const updated = await manager
						.createQueryBuilder()
						.update(VirtualThermostatConfigEntity)
						.set({ comfort: intended, revision: row.revision + 1 })
						.where({ controllerId: input.id, ownerDeviceId: owner.id, revision: row.revision, locked: false })
						// Keep mutation listeners and actual ownership beforeQuery/outer hooks enabled.
						.execute();
					assert();
					if (updated.affected !== 1) refuse('Thermostat selection lost its conditional update.');
					const postimage = await manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOneOrFail();
					const graph = await manager
						.createQueryBuilder(VirtualGraphRevisionEntity, 'graph')
						.where('graph.id = 1')
						.callListeners(false)
						.getOneOrFail();
					assert();
					if (
						postimage.controllerId !== input.id ||
						postimage.ownerDeviceId !== owner.id ||
						postimage.revision !== row.revision + 1 ||
						serialize(postimage.comfort) !== intendedJson ||
						!revision(graph.revision, 1) ||
						graph.revision !== input.expected_graph_revision + 1
					)
						refuse('Thermostat selection persisted an unexpected postimage.');
					const value = detach({
						controller: postimage.controllerId,
						revision: postimage.revision,
						graph_revision: graph.revision,
						configuration: postimage.comfort,
						effective: effective(postimage.policy, postimage.comfort),
						clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
					}) as unknown as SelectionResult;
					// The provisional scalar plan is qualified only by the exact persisted postimage above.
					plan = birth;
					settlement.result = Object.freeze({ value });
					ready = true;
					return value;
				},
				accepted(): void {
					// A later read, even an identical postimage, cannot upgrade UNKNOWN to ACK.
					if (settlement.outcome !== 'committed' || !settlement.result)
						throw new Error('Missing original native thermostat selection ACK/result');
				},
				copy(): SelectionResult {
					if (settlement.outcome !== 'committed' || !settlement.result) refuse();
					// Fresh mutable input for the existing controller/class-transformer materializer.
					return JSON.parse(serialize(settlement.result.value)) as SelectionResult;
				},
			});
		},
	});
}

export const thermostatComfortSelection = Object.freeze({ pin });
