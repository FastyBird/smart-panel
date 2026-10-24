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
	effectiveThermostatComfort,
	validateThermostatComfort,
} from './virtual-thermostat-comfort.utils';

interface SelectionInput extends ThermostatComfortFence {
	readonly id: string;
	readonly preset: ThermostatPreset | null;
	readonly clearUserOff: boolean;
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

/** Concrete selection only. Receipt/result presence survives transaction, release and final-read errors. */
export class ThermostatSelectionSettlement {
	receipt?: SqliteCommitGuardReceipt;
	result?: Readonly<{ value: SelectionResult }>;
	preSettleFailure?: Readonly<{ cause: unknown }>;
	transactionFailure?: Readonly<{ cause: unknown }>;
	finalGetFailure?: Readonly<{ cause: unknown }>;
	get outcome() {
		return this.receipt?.outcome ?? 'not_started';
	}
}

/** Capture before service fence getters. No caller supplies a manager, change callback or result. */
function pin(database: DataSource) {
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
	const current = () =>
		source.current() && root.current() && driver.current() && native.current() && database.isInitialized;
	const check = () => {
		if (!current()) refuse();
	};
	return Object.freeze({
		current,
		input(id: string, fence: ThermostatComfortFence, preset: ThermostatPreset | null, clearUserOff: boolean) {
			const input: SelectionInput = Object.freeze({
				id,
				expected_revision: fence.expected_revision,
				expected_graph_revision: fence.expected_graph_revision,
				preset,
				clearUserOff,
			});
			check();
			if (
				typeof id !== 'string' ||
				!id ||
				!revision(input.expected_revision, 1) ||
				!revision(input.expected_graph_revision, 0) ||
				(preset !== null && !['comfort', 'eco', 'away'].includes(preset)) ||
				typeof clearUserOff !== 'boolean'
			)
				refuse('Invalid thermostat selection or revision fences.');
			return input;
		},
		operation(input: SelectionInput, ownerCurrent: () => boolean, dispatchCurrent: () => boolean) {
			const settlement = new ThermostatSelectionSettlement();
			let ready = false;
			let original: EntityManager | undefined;
			let scopedCurrent: (() => boolean) | undefined;
			const valid = () => current() && dispatchCurrent() && scopedCurrent?.() === true && ownerCurrent();
			const assert = () => {
				if (!valid()) refuse();
			};
			return Object.freeze({
				settlement,
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
					guard(manager, () => ready && !!settlement.result && valid());
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
					if (!row.comfort) refuse('Configure explicit comfort ranges and presets first.');
					// ownedJson rejects non-JSON and recursively freezes the retained value; mutate a fresh copy.
					const intended = JSON.parse(serialize(row.comfort)) as ThermostatComfortConfiguration;
					intended.selected_preset = input.preset;
					if (input.clearUserOff) intended.user_off = false;
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
