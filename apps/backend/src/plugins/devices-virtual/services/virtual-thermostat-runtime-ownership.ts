import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { ClimateAutomationJson } from '../../../modules/devices/contracts/climate-automation.contract';
import { canonical, increment } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { captureCreation, snapshotCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';

declare const decisionIdentity: unique symbol;
export interface ThermostatOwnedDecision {
	readonly [decisionIdentity]: true;
}
interface Decision {
	readonly controllerId: string;
	readonly completion: Promise<void>;
	readonly resolve: () => void;
	readonly reject: (cause: unknown) => void;
	readonly commands: Map<string, { readonly matchesIdentity: () => boolean; readonly completion: Promise<void> }>;
	started: boolean;
	accepting: boolean;
}

/** Exact issued decision/command completion, never a changing runtime queue or actuation authority. */
export class ThermostatRuntimeOwnership {
	private readonly identities = new WeakMap<ThermostatOwnedDecision, Decision>();
	private readonly pending = new Map<string, Set<Decision>>();
	private readonly current = new AsyncLocalStorage<Decision>();

	admit(controllerId: string): ThermostatOwnedDecision {
		let resolve: () => void;
		let reject: (cause: unknown) => void;
		const completion = new Promise<void>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		// Some ordinary callers deliberately do not join. Retain the original rejecting promise for a captured join.
		void completion.catch(() => undefined);
		const decision: Decision = {
			controllerId,
			completion,
			resolve,
			reject,
			commands: new Map(),
			started: false,
			accepting: false,
		};
		const identity = Object.freeze({}) as ThermostatOwnedDecision;
		this.identities.set(identity, decision);
		const pending = this.pending.get(controllerId) ?? new Set<Decision>();
		pending.add(decision);
		this.pending.set(controllerId, pending);
		return identity;
	}

	completion(identity: ThermostatOwnedDecision): Promise<void> {
		const decision = this.identities.get(identity);
		if (!decision || decision.started) throw new Error('Original unstarted thermostat decision required');
		return decision.completion;
	}

	async run(identity: ThermostatOwnedDecision, evaluate: () => Promise<void>): Promise<void> {
		const decision = this.identities.get(identity);
		if (!decision || decision.started) throw new Error('Original thermostat decision required');
		decision.started = true;
		decision.accepting = true;
		let failure: { cause: unknown } | undefined;
		try {
			await this.current.run(decision, evaluate);
		} catch (cause: unknown) {
			failure = { cause };
			throw cause;
		} finally {
			decision.accepting = false;
			this.identities.delete(identity);
			// All command promises were enrolled at prepare, before evaluate returned. A later poll/event gets its own decision.
			void Promise.allSettled([...decision.commands.values()].map((command) => command.completion)).then((results) => {
				const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
				if (failure) decision.reject(failure.cause);
				else if (rejected) decision.reject(rejected.reason as unknown);
				else if ([...decision.commands.values()].some((command) => !command.matchesIdentity()))
					decision.reject(new Error('Original thermostat command identity changed'));
				else decision.resolve();
				const pending = this.pending.get(decision.controllerId);
				pending?.delete(decision);
				if (!pending?.size) this.pending.delete(decision.controllerId);
			});
		}
	}

	enroll(command: VirtualThermostatCommandEntity, completion: Promise<void>): void {
		const decision = this.current.getStore();
		if (!decision?.accepting || decision.controllerId !== command.controllerId || decision.commands.has(command.id))
			throw new Error('Original accepting thermostat decision required');
		const tuple = () =>
			JSON.stringify([
				command.id,
				command.controllerId,
				command.claimId,
				command.claimRevision,
				command.configurationRevision,
				command.decisionRevision,
				command.action,
			]);
		const identity = tuple();
		decision.commands.set(command.id, {
			matchesIdentity: () => tuple() === identity,
			completion,
		});
	}

	/** Snapshot synchronously at mutation entry; the caller joins outside the locks these originals require. */
	capture(controllerId: string): Promise<void> {
		const originals = [...(this.pending.get(controllerId) ?? [])].map((decision) => decision.completion);
		let failure: { cause: unknown } | undefined;
		return Promise.all(
			originals.map((original) =>
				original.catch((cause: unknown) => {
					failure ??= { cause };
				}),
			),
		).then(() => {
			if (failure) throw failure.cause;
		});
	}
}

const commandColumns = [
	'id',
	'controllerId',
	'claimId',
	'claimRevision',
	'configurationRevision',
	'decisionRevision',
	'action',
	'status',
	'preparedAt',
	'dispatchedAt',
	'settledAt',
	'proofId',
	'fault',
] as const;
const branchColumns = [
	'claimId',
	'activity',
	'lastVerifiedOffAt',
	'releaseProofId',
	'releaseAttempts',
	'nextReleaseAt',
	'fault',
	'floorLatched',
] as const;
const stateColumns = [
	'controllerId',
	'decisionRevision',
	'configurationRevision',
	'floorLatched',
	'heuristicHold',
	'previousDemand',
	'reasons',
	'evaluatedAt',
] as const;
type RuntimeRow = VirtualThermostatRuntimeEntity | VirtualThermostatBranchRuntimeEntity;
type RuntimeImage = Readonly<Record<string, unknown>>;
type BranchImage = Readonly<Record<(typeof branchColumns)[number], unknown>>;
const commandIdentity = [...commandColumns.slice(0, 7), 'preparedAt'] as const;
type CommandImage = Readonly<Record<(typeof commandColumns)[number], unknown>>;

/** Exact original journal rows. A late outcome is history, never renewed actuation authority. */
export class ThermostatRuntimeJournal {
	private readonly originals = new WeakMap<VirtualThermostatCommandEntity, CommandImage>();
	private readonly pendingImages = new WeakMap<readonly VirtualThermostatCommandEntity[], readonly CommandImage[]>();
	private readonly runtimeRows = new WeakMap<RuntimeRow, RuntimeImage | null>();
	private readonly scopes = new WeakMap<
		EntityManager,
		{
			current: () => boolean;
			verify: (() => Promise<void>)[];
			accept: (() => void)[];
		}
	>();
	constructor(
		private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
	) {}
	private refuse(): never {
		throw new Error('Original thermostat command journal image required');
	}
	private image(command: VirtualThermostatCommandEntity): CommandImage {
		const metadata = this.database.getMetadata(VirtualThermostatCommandEntity);
		return Object.freeze(
			Object.fromEntries(
				commandColumns.map((key) => {
					if (command[key] === undefined) this.refuse();
					return [
						key,
						this.database.driver.preparePersistentValue(
							snapshotCreation(command[key]),
							metadata.findColumnWithPropertyName(key),
						) as unknown,
					];
				}),
			),
		) as CommandImage;
	}
	private async read(manager: EntityManager, id: string): Promise<CommandImage | undefined> {
		return manager
			.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
			.select(commandColumns.map((key) => `command.${key} AS "${key}"`))
			.where('command.id = :id', { id })
			.callListeners(false)
			.getRawOne<CommandImage>();
	}
	private equal(left: CommandImage | undefined, right: CommandImage): boolean {
		return !!left && commandColumns.every((key) => Object.is(left[key], right[key]));
	}
	private rowShape(row: RuntimeRow): {
		entity: typeof VirtualThermostatRuntimeEntity | typeof VirtualThermostatBranchRuntimeEntity;
		columns: readonly string[];
		key: string;
		id: string;
	} {
		return row instanceof VirtualThermostatRuntimeEntity
			? { entity: VirtualThermostatRuntimeEntity, columns: stateColumns, key: 'controllerId', id: row.controllerId }
			: { entity: VirtualThermostatBranchRuntimeEntity, columns: branchColumns, key: 'claimId', id: row.claimId };
	}
	private async readRuntimeRow(manager: EntityManager, row: RuntimeRow): Promise<RuntimeImage | null> {
		const shape = this.rowShape(row);
		return (
			(await manager
				.createQueryBuilder(shape.entity, 'owned')
				.select(shape.columns.map((key) => `owned.${key} AS "${key}"`))
				.where(`owned.${shape.key} = :id`, { id: shape.id })
				.callListeners(false)
				.getRawOne<RuntimeImage>()) ?? null
		);
	}
	private runtimeImage(row: RuntimeRow): RuntimeImage {
		const shape = this.rowShape(row),
			metadata = this.database.getMetadata(shape.entity);
		return Object.freeze(
			Object.fromEntries(
				shape.columns.map((key) => {
					const value: unknown = Reflect.get(row, key);
					if (value === undefined) this.refuse();
					return [
						key,
						this.database.driver.preparePersistentValue(
							snapshotCreation(value),
							metadata.findColumnWithPropertyName(key),
						) as unknown,
					];
				}),
			),
		);
	}
	/** Capture the actual row read by this decision. Missing rows are born only if still absent at native admission. */
	async captureRuntimeRow(manager: EntityManager, row: RuntimeRow): Promise<void> {
		const before = await this.readRuntimeRow(manager, row);
		const image = this.runtimeImage(row);
		if (before) {
			const metadata = this.database.getMetadata(this.rowShape(row).entity);
			for (const key of this.rowShape(row).columns) {
				const column = metadata.findColumnWithPropertyName(key);
				const hydrated: unknown = this.database.driver.prepareHydratedValue(before[key], column);
				const normalized: unknown = this.database.driver.preparePersistentValue(hydrated, column);
				if (JSON.stringify(normalized) !== JSON.stringify(image[key])) this.refuse();
			}
		}
		this.runtimeRows.set(row, before && Object.freeze({ ...before }));
	}
	async writeRuntimeRows(manager: EntityManager, rows: readonly RuntimeRow[]): Promise<void> {
		const scope = this.scopes.get(manager);
		if (!scope?.current()) this.refuse();
		const plans = rows.map((row) => {
			if (!this.runtimeRows.has(row)) this.refuse();
			const before = this.runtimeRows.get(row),
				value = snapshotCreation(row),
				shape = this.rowShape(row);
			const after = { ...this.runtimeImage(value) };
			if (before) {
				const metadata = this.database.getMetadata(shape.entity);
				for (const key of shape.columns) {
					const column = metadata.findColumnWithPropertyName(key);
					const hydrated: unknown = this.database.driver.prepareHydratedValue(before[key], column);
					const normalized: unknown = this.database.driver.preparePersistentValue(hydrated, column);
					if (JSON.stringify(normalized) === JSON.stringify(after[key])) after[key] = before[key];
				}
			}
			return { row, value, shape, before, after: Object.freeze(after) };
		});
		if (new Set(plans.map(({ shape }) => `${shape.key}:${shape.id}`)).size !== plans.length) this.refuse();
		for (const { row, value, shape, before, after } of plans) {
			const actual = await this.readRuntimeRow(manager, row);
			if (before ? !actual || shape.columns.some((key) => !Object.is(before[key], actual[key])) : actual) this.refuse();
			if (!before) {
				await manager.insert(shape.entity, value);
			} else {
				const changed = shape.columns.filter((key) => !Object.is(before[key], after[key]));
				if (changed.length) {
					const query = manager
						.createQueryBuilder()
						.update(shape.entity)
						.set(
							Object.fromEntries(
								changed.map((key) => [key, Reflect.get(value, key) as unknown]),
							) as QueryDeepPartialEntity<RuntimeRow>,
						);
					for (const key of shape.columns) query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: before[key] });
					if ((await query.execute()).affected !== 1) this.refuse();
				}
			}
		}
		scope.verify.push(async () => {
			for (const { row, shape, after } of plans) {
				const actual = await this.readRuntimeRow(manager, row);
				if (!actual || shape.columns.some((key) => !Object.is(after[key], actual[key]))) this.refuse();
			}
		});
		if (!scope.current()) this.refuse();
		scope.accept.push(() => {
			for (const { row, after } of plans) this.runtimeRows.set(row, after);
		});
	}
	private async readPending(manager: EntityManager, controllerId: string, claimId: string): Promise<CommandImage[]> {
		return manager
			.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
			.select(commandColumns.map((key) => `command.${key} AS "${key}"`))
			.where('command.controllerId = :controllerId AND command.claimId = :claimId', { controllerId, claimId })
			.andWhere("command.status NOT IN ('confirmed', 'cancelled')")
			.orderBy('command.id')
			.callListeners(false)
			.getRawMany<CommandImage>();
	}
	async capturePending(
		manager: EntityManager,
		commands: readonly VirtualThermostatCommandEntity[],
		controllerId: string,
		claimId: string,
	): Promise<void> {
		const rows = await this.readPending(manager, controllerId, claimId);
		if (rows.length !== commands.length) this.refuse();
		const metadata = this.database.getMetadata(VirtualThermostatCommandEntity);
		for (const row of rows) {
			const command = commands.find((candidate) => candidate.id === row.id);
			if (!command) this.refuse();
			const image = this.image(command);
			for (const key of commandColumns) {
				const column = metadata.findColumnWithPropertyName(key);
				const hydrated: unknown = this.database.driver.prepareHydratedValue(row[key], column);
				const normalized: unknown = this.database.driver.preparePersistentValue(hydrated, column);
				if (!Object.is(normalized, image[key])) this.refuse();
			}
		}
		this.pendingImages.set(commands, Object.freeze(rows.map((row) => Object.freeze({ ...row }))));
	}
	addNativeCheck(manager: EntityManager, verify: () => Promise<void>, guard: () => boolean): void {
		const scope = this.scopes.get(manager);
		if (!scope?.current()) this.refuse();
		scope.verify.push(verify);
		registerSqliteCommitGuard(manager, guard);
	}
	/** Settle only the complete original pre-I/O command set; no late row or rewritten history is adopted. */
	async confirmPending(
		manager: EntityManager,
		commands: readonly VirtualThermostatCommandEntity[],
		controllerId: string,
		claimId: string,
		proofId: string,
		settledAt: Date,
	): Promise<boolean> {
		const scope = this.scopes.get(manager),
			before = this.pendingImages.get(commands);
		if (!scope?.current() || !before) this.refuse();
		const current = await this.readPending(manager, controllerId, claimId);
		if (current.length !== before.length || current.some((row, index) => !this.equal(row, before[index]))) return false;
		const storedAt: unknown = this.database.driver.preparePersistentValue(
			settledAt,
			this.database.getMetadata(VirtualThermostatCommandEntity).findColumnWithPropertyName('settledAt'),
		);
		for (let offset = 0; offset < before.length; offset += 32) {
			const batch = before.slice(offset, offset + 32);
			const query = manager
				.createQueryBuilder()
				.update(VirtualThermostatCommandEntity)
				.set({ status: 'confirmed', proofId, settledAt });
			for (const [index, row] of batch.entries()) {
				const parameters: Record<string, unknown> = {};
				query.orWhere(
					`(${commandColumns
						.map((key) => {
							parameters[`${index}_${key}`] = row[key];
							return `"${key}" IS :${index}_${key}`;
						})
						.join(' AND ')})`,
					parameters,
				);
			}
			if ((await query.execute()).affected !== batch.length) this.refuse();
		}
		scope.verify.push(async () => {
			if ((await this.readPending(manager, controllerId, claimId)).length) this.refuse();
			for (const row of before)
				if (
					!this.equal(await this.read(manager, row.id as string), {
						...row,
						status: 'confirmed',
						proofId,
						settledAt: storedAt,
					})
				)
					this.refuse();
		});
		return true;
	}
	async persistRuntimeRows(rows: readonly RuntimeRow[]): Promise<void> {
		await this.runNative((manager) => this.writeRuntimeRows(manager, rows));
	}
	async runNative<T>(work: (manager: EntityManager, current: () => boolean) => Promise<T>): Promise<T> {
		const database = captureCreation(this.database, ['transaction', 'driver', 'manager']);
		const driver = captureCreation(
			this.database.driver as DataSource['driver'] & {
				connection: DataSource;
				databaseConnection: { all: (...args: unknown[]) => unknown };
			},
			['connection', 'databaseConnection', 'createQueryRunner'],
		);
		const physical = driver.values.databaseConnection;
		if (!physical || driver.values.connection !== this.database) this.refuse();
		const native = captureCreation(physical, ['all']);
		return this.structure.runExclusive(async () => {
			const owner = this.structure.captureExclusiveOwner();
			let receipt: SqliteCommitGuardReceipt | undefined;
			const accepted: (() => void)[] = [];
			const transaction = database.values.transaction as unknown as {
				call: (receiver: DataSource, work: (manager: EntityManager) => Promise<T>) => Promise<T>;
			};
			const result = await transaction.call(this.database, async (manager: EntityManager) => {
				receipt = observeSqliteOuterOutcome(manager); // FIRST, before reservation or any authority read.
				const selected = captureCreation(manager, [
					'connection',
					'queryRunner',
					'query',
					'createQueryBuilder',
					'insert',
				]);
				const runner = manager.queryRunner;
				if (!runner) this.refuse();
				const runnerPin = captureCreation(runner as QueryRunner & { driver: DataSource['driver'] }, [
					'manager',
					'connection',
					'driver',
					'query',
					'connect',
					'commitTransaction',
					'release',
				]);
				let ready = false;
				const current = () =>
					database.current() &&
					driver.current() &&
					native.current() &&
					selected.current() &&
					runnerPin.current() &&
					owner() &&
					manager.connection === this.database &&
					runner.manager === manager &&
					runner.connection === this.database &&
					runnerPin.values.driver === database.values.driver &&
					runner.isTransactionActive &&
					Reflect.get(runner, 'transactionDepth') === 1 &&
					Reflect.get(database.values.driver, 'databaseConnection') === physical;
				registerSqliteCommitGuard(manager, () => ready && current());
				if (!current()) this.refuse();
				await manager.query('UPDATE "devices_virtual_thermostat_command_journal" SET "status"="status" WHERE 0');
				if (!current()) this.refuse();
				const scope = { current, verify: [] as (() => Promise<void>)[], accept: accepted };
				this.scopes.set(manager, scope);
				try {
					const value = await work(manager, current);
					for (const verify of scope.verify) await verify();
					if (!current()) this.refuse();
					ready = true;
					return value;
				} finally {
					this.scopes.delete(manager);
				}
			});
			if (receipt?.outcome !== 'committed') this.refuse();
			for (const accept of accepted) accept();
			return result as T;
		});
	}
	/** Restart is diagnostic suspension only; its original native rows are never new OFF/ON authority. */
	async restart(inFlight: readonly VirtualThermostatCommandEntity[] = []): Promise<void> {
		// Only original objects acknowledged by this journal can retain an outstanding native outcome.
		for (const command of inFlight) if (!this.originals.has(command)) this.refuse();
		await this.runNative(async (manager, current) => {
			const pending = await manager
				.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
				.select(commandColumns.map((key) => `command.${key} AS "${key}"`))
				.where("command.status IN ('prepared','dispatching')")
				.orderBy('command.id')
				.callListeners(false)
				.getRawMany<CommandImage>();
			const branches = await manager
				.createQueryBuilder(VirtualThermostatBranchRuntimeEntity, 'branch')
				.select(branchColumns.map((key) => `branch.${key} AS "${key}"`))
				.orderBy('branch.claimId')
				.callListeners(false)
				.getRawMany<BranchImage>();
			const retained = new Map<string, CommandImage>();
			for (const command of inFlight) {
				const original = this.originals.get(command),
					value = this.image(command);
				if (!original || commandIdentity.some((key) => !Object.is(original[key], value[key]))) this.refuse();
				const row = pending.find((candidate) => candidate.id === original.id);
				if (!row) continue;
				if (!this.equal(row, original)) this.refuse();
				retained.set(row.id as string, row);
			}
			const suspended = pending.filter((row) => !retained.has(row.id as string));
			for (let offset = 0; offset < suspended.length; offset += 32) {
				const batch = suspended.slice(offset, offset + 32);
				const query = manager
					.createQueryBuilder()
					.update(VirtualThermostatCommandEntity)
					.set({ status: 'unknown', fault: 'restart_requires_release_reconciliation' });
				for (const [index, row] of batch.entries()) {
					const parameters: Record<string, unknown> = {};
					const predicate = commandColumns
						.map((key) => {
							parameters[`${index}_${key}`] = row[key];
							return `"${key}" IS :${index}_${key}`;
						})
						.join(' AND ');
					query.orWhere(`(${predicate})`, parameters);
				}
				if ((await query.execute()).affected !== batch.length) this.refuse();
			}
			for (let offset = 0; offset < branches.length; offset += 32) {
				const batch = branches.slice(offset, offset + 32);
				const query = manager
					.createQueryBuilder()
					.update(VirtualThermostatBranchRuntimeEntity)
					.set({ activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null });
				for (const [index, row] of batch.entries()) {
					const parameters: Record<string, unknown> = {};
					const predicate = branchColumns
						.map((key) => {
							parameters[`${index}_${key}`] = row[key];
							return `"${key}" IS :${index}_${key}`;
						})
						.join(' AND ');
					query.orWhere(`(${predicate})`, parameters);
				}
				if ((await query.execute()).affected !== batch.length) this.refuse();
			}
			for (const row of pending) {
				const expected = retained.has(row.id as string)
					? row
					: {
							...row,
							status: 'unknown',
							fault: 'restart_requires_release_reconciliation',
						};
				if (!this.equal(await this.read(manager, row.id as string), expected)) this.refuse();
			}
			const remaining = await manager
				.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
				.where("command.status IN ('prepared','dispatching')")
				.getCount();
			const after = await manager
				.createQueryBuilder(VirtualThermostatBranchRuntimeEntity, 'branch')
				.select(branchColumns.map((key) => `branch.${key} AS "${key}"`))
				.orderBy('branch.claimId')
				.callListeners(false)
				.getRawMany<BranchImage>();
			if (remaining !== retained.size || after.length !== branches.length || !current()) this.refuse();
			for (const [index, row] of branches.entries()) {
				const expected = { ...row, activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null };
				if (!branchColumns.every((key) => Object.is(expected[key], after[index][key]))) this.refuse();
			}
		});
	}
	async insert(
		command: VirtualThermostatCommandEntity,
		branch: VirtualThermostatBranchRuntimeEntity,
		validate?: (manager: EntityManager) => Promise<void>,
	): Promise<void> {
		if (this.originals.has(command)) this.refuse();
		const value = snapshotCreation(command),
			expected = this.image(value);
		await this.runNative(async (manager, current) => {
			if (validate) {
				await validate(manager);
				this.scopes.get(manager).verify.push(() => validate(manager));
			}
			if (await this.read(manager, value.id)) this.refuse();
			await manager.insert(VirtualThermostatCommandEntity, value);
			await this.writeRuntimeRows(manager, [branch]);
			if (
				!current() ||
				!this.equal(await this.read(manager, value.id), expected) ||
				!this.equal(this.image(command), expected)
			)
				this.refuse();
			this.scopes.get(manager).accept.push(() => this.originals.set(command, expected));
		});
	}
	async write(
		command: VirtualThermostatCommandEntity,
		validate?: (manager: EntityManager) => Promise<void>,
	): Promise<void> {
		const before = this.originals.get(command);
		if (!before) this.refuse();
		const value = snapshotCreation(command),
			expected = this.image(value);
		if (commandIdentity.some((key) => !Object.is(before[key], expected[key]))) this.refuse();
		await this.runNative(async (manager, current) => {
			if (validate) {
				await validate(manager);
				this.scopes.get(manager).verify.push(() => validate(manager));
			}
			if (!this.equal(await this.read(manager, value.id), before)) this.refuse();
			const query = manager.createQueryBuilder().update(VirtualThermostatCommandEntity).set({
				status: value.status,
				dispatchedAt: value.dispatchedAt,
				settledAt: value.settledAt,
				proofId: value.proofId,
				fault: value.fault,
			});
			for (const key of commandColumns) query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: before[key] });
			if ((await query.execute()).affected !== 1) this.refuse();
			if (!current() || !this.equal(await this.read(manager, value.id), expected)) this.refuse();
			this.scopes.get(manager).accept.push(() => this.originals.set(command, expected));
		});
	}
}

/** Native retained history is archived/compared in full; it never grants successor actuation authority. */
type RecreationHistoryRow = Readonly<Record<string, ClimateAutomationJson>>;
export interface ThermostatRecreationHistory {
	readonly runtime: readonly RecreationHistoryRow[];
	readonly branches: readonly RecreationHistoryRow[];
	readonly commands: readonly RecreationHistoryRow[];
}
export async function readThermostatRecreationHistory(
	manager: EntityManager,
	controllerId: string,
): Promise<ThermostatRecreationHistory> {
	const rows = async (sql: string): Promise<readonly RecreationHistoryRow[]> =>
		Object.freeze(
			(await manager.query<RecreationHistoryRow[]>(sql, [controllerId])).map((row) => Object.freeze({ ...row })),
		);
	return Object.freeze({
		runtime: await rows(
			'SELECT * FROM "devices_virtual_thermostat_runtime" WHERE "controllerId"=? ORDER BY "controllerId"',
		),
		branches: await rows(
			'SELECT * FROM "devices_virtual_thermostat_branch_runtime" WHERE "claimId" IN (SELECT "id" FROM "devices_virtual_thermostat_actuator_claims" WHERE "controllerId"=?) ORDER BY "claimId"',
		),
		commands: await rows(
			'SELECT * FROM "devices_virtual_thermostat_command_journal" WHERE "controllerId"=? ORDER BY "id"',
		),
	});
}
export async function assertThermostatRecreationHistory(
	manager: EntityManager,
	id: string,
	expected: ThermostatRecreationHistory,
): Promise<void> {
	if (canonical(await readThermostatRecreationHistory(manager, id)) !== canonical(expected))
		throw new Error('Retained thermostat runtime history changed');
}
/** The caller archives before invoking this function in its original admitted creation unit. */
export async function resetThermostatRecreationRuntime(
	manager: EntityManager,
	id: string,
	before: ThermostatRecreationHistory,
	claims: readonly Readonly<Record<string, unknown>>[],
	configurationRevision: number,
): Promise<ThermostatRecreationHistory> {
	const refuse = (): never => {
		throw new Error('Retained thermostat history is not eligible for fresh creation');
	};
	await assertThermostatRecreationHistory(manager, id, before);
	if (
		before.runtime.length > 1 ||
		(before.commands.length && before.runtime.length !== 1) ||
		claims.some((claim) => claim.state !== 'released')
	)
		refuse();
	for (const command of before.commands) {
		const claim = claims.find((row) => row.id === command.claimId);
		if (
			!claim ||
			!['confirmed', 'cancelled'].includes(command.status as string) ||
			!Number.isSafeInteger(command.configurationRevision) ||
			(command.configurationRevision as number) >= configurationRevision
		)
			refuse();
		if (command.action === 'on' && command.dispatchedAt !== null) {
			// Terminal journal status is not OFF proof. Keep the native qualified-release barrier
			// and original branch proof; none of it becomes a live successor qualification.
			const release =
				typeof claim.releaseEvidence === 'string'
					? (JSON.parse(claim.releaseEvidence) as Record<string, unknown>)
					: null;
			const branch = before.branches.find((row) => row.claimId === claim.id);
			if (
				!claim.releasedAt ||
				!release ||
				release.outputConfirmedOff !== true ||
				release.pendingOnDrained !== true ||
				typeof release.evidenceId !== 'string' ||
				!release.evidenceId ||
				branch?.activity !== 'off' ||
				branch.releaseProofId !== release.evidenceId ||
				!branch.lastVerifiedOffAt
			)
				refuse();
		}
	}
	const previous = before.runtime[0];
	if (!previous) return before;
	if (
		!Number.isSafeInteger(previous.decisionRevision) ||
		(previous.decisionRevision as number) < 0 ||
		(previous.decisionRevision as number) >= Number.MAX_SAFE_INTEGER ||
		!Number.isSafeInteger(configurationRevision) ||
		configurationRevision < 1
	)
		refuse();
	const decisionRevision = previous.decisionRevision === 0 ? 1 : increment(previous.decisionRevision as number);
	if (
		before.commands.some(
			(command) =>
				!Number.isSafeInteger(command.decisionRevision) || (command.decisionRevision as number) >= decisionRevision,
		)
	)
		refuse();
	const evaluatedAt = new Date();
	const update = manager.createQueryBuilder().update(VirtualThermostatRuntimeEntity).set({
		decisionRevision,
		configurationRevision,
		floorLatched: false,
		heuristicHold: null,
		previousDemand: 'off',
		reasons: [],
		evaluatedAt,
	});
	for (const [column, value] of Object.entries(previous))
		update.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: value });
	if ((await update.execute()).affected !== 1) refuse();
	const column = manager.connection
		.getMetadata(VirtualThermostatRuntimeEntity)
		.findColumnWithPropertyName('evaluatedAt');
	const expected: ThermostatRecreationHistory = {
		...before,
		runtime: [
			{
				...previous,
				decisionRevision,
				configurationRevision,
				floorLatched: 0,
				heuristicHold: null,
				previousDemand: 'off',
				reasons: '[]',
				evaluatedAt: manager.connection.driver.preparePersistentValue(evaluatedAt, column) as string,
			},
		],
	};
	await assertThermostatRecreationHistory(manager, id, expected);
	return expected;
}
