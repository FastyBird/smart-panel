import {
	Column,
	DataSource,
	Entity,
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	MigrationInterface,
	PrimaryGeneratedColumn,
	QueryRunner,
} from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';

import AppDataSource from '../../dataSource';
import { DeviceStructureLockService } from '../../modules/devices/services/device-structure-lock.service';

import {
	SqliteCommitGuardReceipt,
	SqliteCommitGuardRefusedError,
	SqliteDataSource,
	createSqliteDataSource,
	isSqliteTransactionActive,
	outsideSqliteTransaction,
	registerSqliteCommitGuard,
} from './sqlite-data-source';

@Entity()
class TransactionRecord {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}

@EventSubscriber()
class PersistenceHook implements EntitySubscriberInterface<TransactionRecord> {
	listenTo() {
		return TransactionRecord;
	}

	async afterInsert(event: InsertEvent<TransactionRecord>): Promise<void> {
		if (event.entity.name === 'with-hook') {
			// Existing hooks sometimes use an injected/global repository rather than event.manager.
			await event.connection.getRepository(TransactionRecord).save({ name: 'hook-record' });
		}
	}
}

class CoordinatorProbe1000000000999 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query('CREATE TABLE migration_probe (name TEXT NOT NULL)');
		await runner.query('INSERT INTO migration_probe (name) VALUES (?)', ['migrated']);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TABLE migration_probe');
	}
}

function deferred() {
	let resolve: () => void;
	const promise = new Promise<void>((done) => (resolve = done));

	return { promise, resolve: () => resolve() };
}

type NativeCallback = (this: unknown, error: Error | null, rows?: unknown[]) => void;
interface NativeConnection {
	all(query: string, parameters: unknown[], callback: NativeCallback): unknown;
}

describe('SQLite connection transaction coordination (real sqlite3 / TypeORM)', () => {
	let database: SqliteDataSource;

	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [TransactionRecord],
			subscribers: [PersistenceHook],
			synchronize: true,
		});
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	const names = async () =>
		(await database.getRepository(TransactionRecord).find({ order: { name: 'ASC' } })).map((row) => row.name);

	const shortAcquisitionTimeout = async () => {
		await database.destroy();
		database = await new SqliteDataSource(
			{ type: 'sqlite', database: ':memory:', entities: [TransactionRecord], synchronize: true },
			{ acquisitionTimeoutMs: 50 },
		).initialize();
	};

	describe('guarded outer native COMMIT admission', () => {
		const nativeConnection = () => (database.driver as SqliteDriver).databaseConnection as NativeConnection;

		it('composes same-manager nested guards on outer COMMIT without self-wait or admitting another lease', async () => {
			let checks = 0;
			let first: SqliteCommitGuardReceipt;
			let second: SqliteCommitGuardReceipt;
			const launch = deferred();
			const independent = (async () => {
				await launch.promise;
				return names();
			})();
			await database.transaction(async (manager) => {
				first = registerSqliteCommitGuard(manager, () => { checks++; return true; });
				expect(() => registerSqliteCommitGuard(database.manager, () => true)).toThrow('scoped manager');
				await manager.transaction(async (nested) => {
					second = registerSqliteCommitGuard(nested, () => { checks++; return true; });
					await nested.save(TransactionRecord, { name: 'nested-candidate' });
				});
				expect(checks).toBe(0); // RELEASE SAVEPOINT cannot consume final admission.
				launch.resolve();
			});
			expect(checks).toBe(2);
			expect(first.outcome).toBe('committed');
			expect(second.outcome).toBe('committed');
			expect(await independent).toEqual(['nested-candidate']);
		});

		it('refuses after an awaited BeforeTransactionCommit subscriber and rolls back all candidates', async () => {
			const entered = deferred(), release = deferred();
			let current = true;
			let receipt: SqliteCommitGuardReceipt;
			const guard = jest.fn(() => current);
			database.subscribers.push({ beforeTransactionCommit: async () => { entered.resolve(); await release.promise; } });
			const native = nativeConnection();
			const all = jest.spyOn(native, 'all');
			const transaction = database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			await entered.promise;
			expect(guard).not.toHaveBeenCalled();
			current = false;
			release.resolve();
			await rejected;
			expect(all.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(receipt.outcome).toBe('refused');
			expect(await names()).toEqual([]);
		});

		it('drains BeforeQuery children in successive same-lease waves before sealing and evaluating guards', async () => {
			const firstEntered = deferred(), firstRelease = deferred();
			const secondEntered = deferred(), secondRelease = deferred();
			const guard = jest.fn(() => false);
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') {
						void event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-one')");
					} else if (event.query.includes("VALUES ('wave-one')")) {
						firstEntered.resolve(); await firstRelease.promise;
					} else if (event.query.includes("VALUES ('wave-two')")) {
						secondEntered.resolve(); await secondRelease.promise;
					}
				},
				afterQuery: (event) => {
					if (event.query.includes("VALUES ('wave-one')")) {
						void event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-two')");
					}
				},
			});
			const transaction = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'root-candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			await firstEntered.promise;
			expect(guard).not.toHaveBeenCalled();
			firstRelease.resolve();
			await secondEntered.promise;
			expect(guard).not.toHaveBeenCalled();
			secondRelease.resolve();
			await rejected;
			expect(guard).toHaveBeenCalledTimes(1);
			expect(await names()).toEqual([]);
		});

		it('settles a pending BeforeQuery child failure without a native COMMIT or stranded callback', async () => {
			const entered = deferred(), release = deferred();
			const guard = jest.fn(() => true);
			database.subscribers.push({ beforeQuery: async (event) => {
				if (event.query === 'COMMIT') {
					void event.manager.query("INSERT INTO transaction_record(name) VALUES ('failed-child')");
				} else if (event.query.includes("VALUES ('failed-child')")) {
					entered.resolve();
					await release.promise;
					throw new Error('child subscriber failure');
				}
			} });
			const native = jest.spyOn(nativeConnection(), 'all');
			const transaction = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			await entered.promise;
			await new Promise<void>((resolve) => setImmediate(resolve));
			release.resolve();
			await rejected;
			expect(guard).not.toHaveBeenCalled();
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(await names()).toEqual([]);
		});

		it.each([false, true])('retains a settled child rejection before COMMIT subscriber release (late guard: %s)', async (lateGuard) => {
			const settled = deferred(), subscriberRelease = deferred();
			const failure = new Error('settled child subscriber failure');
			const guard = jest.fn(() => true);
			let receipt: SqliteCommitGuardReceipt;
			let observed: unknown;
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') {
						const child = event.manager.query("INSERT INTO transaction_record(name) VALUES ('settled-child')");
						void child.catch((cause: unknown) => {
							observed = cause;
							settled.resolve();
						});
						await subscriberRelease.promise;
						if (lateGuard) receipt = registerSqliteCommitGuard(event.manager, guard);
					} else if (event.query.includes("VALUES ('settled-child')")) {
						throw failure;
					}
				},
			});
			const native = jest.spyOn(nativeConnection(), 'all');
			const transaction = database.transaction(async (manager) => {
				if (!lateGuard) receipt = registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			await settled.promise;
			expect(observed).toBe(failure);
			expect(guard).not.toHaveBeenCalled();
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			const queuedRead = names();
			subscriberRelease.resolve();
			await rejected;
			expect(receipt.outcome).toBe('refused');
			expect(guard).not.toHaveBeenCalled();
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(await queuedRead).toEqual([]);
			database.subscribers.length = 0;
			let recovered: SqliteCommitGuardReceipt;
			await database.transaction(async (manager) => {
				recovered = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'recovered-owner' });
			});
			expect(recovered.outcome).toBe('committed');
			expect(await names()).toEqual(['recovered-owner']);
		});

		it('does not broaden unguarded caught-failure semantics or poison a later guarded transaction', async () => {
			await database.transaction(async (manager) => {
				await expect(manager.query('SELECT * FROM nonexistent_guard_fixture')).rejects.toThrow();
				await manager.save(TransactionRecord, { name: 'unguarded-caught-failure' });
			});
			let receipt: SqliteCommitGuardReceipt;
			await database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'fresh-guarded-owner' });
			});
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['fresh-guarded-owner', 'unguarded-caught-failure']);
		});

		it('accepts a first guard attached by BeforeQuery and refuses without native submission', async () => {
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({ beforeQuery: (event) => {
				if (event.query === 'COMMIT') receipt = registerSqliteCommitGuard(event.manager, () => false);
			} });
			const native = jest.spyOn(nativeConnection(), 'all');
			await expect(database.transaction((manager) => manager.save(TransactionRecord, { name: 'late-guard' })))
				.rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(receipt.outcome).toBe('refused');
			expect(await names()).toEqual([]);
		});

		it('seals new candidate work and guard attachment but permits valid post-commit subscriber work', async () => {
			let lateQuery: Promise<unknown>;
			let receipt: SqliteCommitGuardReceipt;
			let afterQueryReads = 0;
			database.subscribers.push({
				afterQuery: async (event) => {
					if (event.query === 'COMMIT') {
						await event.manager.query('SELECT 1'); afterQueryReads++;
					}
				},
				afterTransactionCommit: (event) => event.manager.query("INSERT INTO transaction_record(name) VALUES ('post-commit')"),
			});
			await database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => {
					expect(() => registerSqliteCommitGuard(manager, () => true)).toThrow('open transaction');
					lateQuery = manager.query("INSERT INTO transaction_record(name) VALUES ('too-late')");
					void lateQuery.catch(() => undefined);
					return true;
				});
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			await expect(lateQuery).rejects.toThrow('sealed');
			expect(afterQueryReads).toBe(1);
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['candidate', 'post-commit']);
		});

		it.each([false, true])('settles false/throw guard refusal through TypeORM and allows rollback recovery (throw: %s)', async (throws) => {
			let receipt: SqliteCommitGuardReceipt;
			let rollbackNotifications = 0;
			database.subscribers.push({
				beforeTransactionRollback: () => { throw new Error('injected rollback subscriber failure'); },
				afterTransactionRollback: () => { rollbackNotifications++; },
			});
			await expect(database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => {
					if (throws) throw new Error('original guard failure');
					return false;
				});
				await manager.save(TransactionRecord, { name: 'must-rollback' });
			})).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			expect(receipt.outcome).toBe('refused');
			expect(rollbackNotifications).toBe(1);
			expect(isSqliteTransactionActive(database)).toBe(false);
			expect(await names()).toEqual([]);
			database.subscribers.length = 0;
			await database.transaction((manager) => manager.save(TransactionRecord, { name: 'next-owner' }));
			expect(await names()).toEqual(['next-owner']);
		});

		it.each([false, true])('rechecks the original guard on every actual TypeORM busy redispatch (revoke: %s)', async (revoke) => {
			Object.assign(database.options, { busyErrorRetry: 1 });
			const native = nativeConnection(), invoke = native.all.bind(native);
			let attempts = 0, current = true;
			let receipt: SqliteCommitGuardReceipt;
			const guard = jest.fn(() => current);
			jest.spyOn(native, 'all').mockImplementation(function (query, parameters, callback) {
				if (query === 'COMMIT' && ++attempts === 1) {
					current = !revoke;
					queueMicrotask(() => callback.call(this, new Error('SQLITE_BUSY: injected busy commit')));
					return this;
				}
				return invoke(query, parameters, callback);
			});
			const log = jest.spyOn(database.logger, 'logQuery');
			const transaction = database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'busy-candidate' });
			});
			if (revoke) {
				await expect(transaction).rejects.toMatchObject({ driverError: expect.any(SqliteCommitGuardRefusedError) });
			} else { await transaction; }
			expect(guard).toHaveBeenCalledTimes(2);
			expect(attempts).toBe(revoke ? 1 : 2);
			expect(receipt.outcome).toBe(revoke ? 'refused' : 'committed');
			expect(log.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(1);
			expect(await names()).toEqual(revoke ? [] : ['busy-candidate']);
		});

		it('preserves native callback receiver, rows, logger and query/transaction broadcasts without patching the shared handle', async () => {
			const native = nativeConnection(), invoke = native.all.bind(native);
			let receiverReads = 0;
			const events: string[] = [];
			const all = jest.spyOn(native, 'all').mockImplementation(function (query, parameters, callback) {
				if (query !== 'COMMIT') return invoke(query, parameters, callback);
				return invoke(query, parameters, function (error, rows) {
					callback.call({ get changes() { receiverReads++; return 0; } }, error, rows);
				});
			});
			const log = jest.spyOn(database.logger, 'logQuery');
			database.subscribers.push({
				beforeTransactionCommit: () => { events.push('before-transaction'); },
				beforeQuery: (event) => { if (event.query === 'COMMIT') events.push('before-query'); },
				afterQuery: (event) => {
					if (event.query === 'COMMIT') {
						expect(event.success).toBe(true); expect(event.rawResults).toEqual([]); events.push('after-query');
					}
				},
				afterTransactionCommit: () => { events.push('after-transaction'); },
			});
			await database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => { events.push('guard'); return true; });
				await manager.query("INSERT INTO transaction_record(name) VALUES ('callback-candidate')");
			});
			expect(nativeConnection()).toBe(native);
			expect(Object.getOwnPropertyDescriptor(native, 'all')?.value).toBe(all); // Shared method unchanged.
			expect(receiverReads).toBe(1);
			expect(events).toEqual(['before-transaction', 'before-query', 'guard', 'after-query', 'after-transaction']);
			expect(log.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(1);
			expect(await names()).toEqual(['callback-candidate']);
		});

		it('keeps a native-submitted ambiguous acknowledgement UNKNOWN even when rows actually committed', async () => {
			const native = nativeConnection(), invoke = native.all.bind(native);
			let receipt: SqliteCommitGuardReceipt;
			jest.spyOn(native, 'all').mockImplementation(function (query, parameters, callback) {
				if (query !== 'COMMIT') return invoke(query, parameters, callback);
				expect(receipt.outcome).toBe('unknown');
				return invoke(query, parameters, function (error, rows) {
					callback.call(this, error ?? new Error('injected missing commit acknowledgement'), rows);
				});
			});
			await expect(database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'durable-but-unconfirmed' });
			})).rejects.toThrow('missing commit acknowledgement');
			expect(receipt.outcome).toBe('unknown');
			expect(await names()).toEqual(['durable-but-unconfirmed']);
		});

		it('observes a handled deferred AfterQuery rejection without claiming TypeORM awaits it', async () => {
			const release = deferred();
			const failure = new Error('deferred after-query failure');
			let observed: Promise<unknown>;
			let handled = false;
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({
				afterQuery: (event) => {
					if (event.query !== 'COMMIT') return;
					const rejected = release.promise.then(() => { throw failure; });
					// Attach our observer BEFORE handing the promise to TypeORM: no unhandled rejection.
					observed = rejected.catch((cause: unknown) => {
						handled = true;
						return cause;
					});
					return rejected;
				},
			});
			await database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'committed-before-deferred-query-failure' });
			});
			// Actual TypeORM0.3.31 waits the initially empty BroadcasterResult before native callback.
			// Its later asynchronous AfterQuery promise is not an awaited transaction failure boundary.
			expect(observed).toBeDefined();
			expect(handled).toBe(false);
			expect(receipt.outcome).toBe('committed');
			release.resolve();
			expect(await observed).toBe(failure);
			expect(handled).toBe(true);
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['committed-before-deferred-query-failure']);
		});

		it('keeps a committed native receipt when an awaited AfterTransactionCommit subscriber fails', async () => {
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({
				afterTransactionCommit: () => { throw new Error('post-commit subscriber failure'); },
			});
			await expect(database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'committed-before-subscriber' });
			})).rejects.toThrow('post-commit subscriber failure');
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['committed-before-subscriber']);
		});

		it('rejects dead/unscoped guard registration and preserves a completed receipt after later transactions', async () => {
			let attach: () => SqliteCommitGuardReceipt;
			let receipt: SqliteCommitGuardReceipt;
			await database.transaction(async (manager) => {
				attach = () => registerSqliteCommitGuard(manager, () => false);
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'original-owner' });
			});
			expect(attach).toThrow('open transaction');
			await database.transaction((manager) => manager.save(TransactionRecord, { name: 'unguarded-owner' }));
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['original-owner', 'unguarded-owner']);
		});
	});

	it('bounds an independent read awaited by its connection owner and recovers the queue', async () => {
		await shortAcquisitionTimeout();
		const launch = deferred();
		const independentRead = (async () => {
			await launch.promise;
			return names();
		})();
		const failure = expect(independentRead).rejects.toThrow('Timed out after 50ms waiting for SQLite');
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'rollback' });
				launch.resolve();
				await independentRead;
			}),
		).rejects.toThrow('do not await independent database work');
		await failure;
		await database.getRepository(TransactionRecord).save({ name: 'healthy' });
		expect(await names()).toEqual(['healthy']);
	});

	it('bounds lock-order inversion instead of freezing the connection', async () => {
		await shortAcquisitionTimeout();
		const structure = new DeviceStructureLockService();
		const acquiredStructure = deferred();
		const launchRead = deferred();
		const external = structure.runExclusive(async () => {
			acquiredStructure.resolve();
			await launchRead.promise;
			await names();
		});
		const rejected = expect(external).rejects.toThrow('Timed out after 50ms');
		await acquiredStructure.promise;
		await database.transaction(async () => {
			launchRead.resolve();
			await structure.runExclusive(() => Promise.resolve());
		});
		await rejected;
		await database.getRepository(TransactionRecord).save({ name: 'after-inversion' });
		expect(await names()).toEqual(['after-inversion']);
	});

	it('requires runner.manager in manual transactions and bounds unscoped access', async () => {
		await shortAcquisitionTimeout();
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.save(TransactionRecord, { name: 'scoped' });
		await expect(names()).rejects.toThrow('Use runner.manager inside manual transactions');
		expect(await runner.manager.count(TransactionRecord)).toBe(1);
		await runner.rollbackTransaction();
		await runner.release();
		expect(await names()).toEqual([]);
	});

	it('cancels queued ownership on destroy and rejects reuse while a fresh instance works', async () => {
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		const pending = database.createQueryRunner().query('SELECT 1');
		const rejected = expect(pending).rejects.toThrow('DataSource was destroyed while waiting');
		await database.destroy();
		await rejected;
		await expect(database.initialize()).rejects.toThrow('create a new DataSource instance');
		const fresh = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		try {
			const freshRunner = fresh.createQueryRunner();
			await freshRunner.startTransaction();
			await runner.release();
			expect(freshRunner.isTransactionActive).toBe(true);
			expect(await freshRunner.query('SELECT 1 AS healthy')).toEqual([{ healthy: 1 }]);
			await freshRunner.commitTransaction();
			await freshRunner.release();
		} finally {
			await fresh.destroy();
		}
	});

	it('drains a started unawaited nested transaction before committing the outer transaction', async () => {
		const childStarted = deferred();
		const finishChild = deferred();
		let nested: Promise<void>;
		let outerFinished = false;
		const outer = database
			.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'outer' });
				nested = manager.transaction(async (child) => {
					await child.save(TransactionRecord, { name: 'child' });
					childStarted.resolve();
					await finishChild.promise;
				});
			})
			.then(() => (outerFinished = true));
		await childStarted.promise;
		expect(outerFinished).toBe(false);
		finishChild.resolve();
		await outer;
		await nested;
		expect(await names()).toEqual(['child', 'outer']);
	});

	it('drains started nested work before rolling back the complete outer transaction', async () => {
		let child: Promise<unknown>;
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'outer-rollback' });
				child = manager.transaction(async (nested) => {
					await nested.save(TransactionRecord, { name: 'child-rollback' });
				});
				throw new Error('outer failure');
			}),
		).rejects.toThrow('outer failure');
		await child;
		expect(await names()).toEqual([]);
	});

	it('drains unawaited automatic persistence before rolling back its owning transaction', async () => {
		let save: Promise<TransactionRecord>;
		await expect(
			database.transaction(() => {
				save = database.getRepository(TransactionRecord).save({ name: 'started-save' });
				return Promise.reject(new Error('owner failed'));
			}),
		).rejects.toThrow('owner failed');
		await save;
		expect(await names()).toEqual([]);
	});

	it('propagates a pending nested transaction failure and rolls back the outer writes', async () => {
		let child: Promise<void>;
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'must-rollback' });
				child = manager.transaction(async (nested) => {
					await nested.save(TransactionRecord, { name: 'child-failure' });
					throw new Error('unawaited child failed');
				});
			}),
		).rejects.toThrow('unawaited child failed');
		await expect(child).rejects.toThrow('unawaited child failed');
		expect(await names()).toEqual([]);
	});

	it('retains the outer active flag and ownership when nested BeforeTransactionStart fails', async () => {
		let starts = 0;
		database.subscribers.push({
			beforeTransactionStart: () => {
				starts++;
				if (starts === 2) throw new Error('nested start hook failed');
			},
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'outer' });
				await expect(manager.transaction(() => Promise.resolve())).rejects.toThrow('nested start hook failed');
				expect(manager.queryRunner.isTransactionActive).toBe(true);
				expect(isSqliteTransactionActive(database)).toBe(true);
				await manager.save(TransactionRecord, { name: 'after-hook-failure' });
				throw new Error('outer rollback');
			}),
		).rejects.toThrow('outer rollback');
		expect(await names()).toEqual([]);
	});

	it('never suppresses outer rollback after a caught failed manual nested start', async () => {
		await shortAcquisitionTimeout();
		let starts = 0;
		database.subscribers.push({
			beforeTransactionStart: () => {
				if (++starts === 2) throw new Error('manual nested start failed');
			},
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'must-rollback' });
				await expect(manager.queryRunner.startTransaction()).rejects.toThrow('manual nested start failed');
				expect(manager.queryRunner.isTransactionActive).toBe(true);
				throw new Error('outer callback failed');
			}),
		).rejects.toThrow('outer callback failed');
		expect(isSqliteTransactionActive(database)).toBe(false);
		expect(await names()).toEqual([]);
		await database.getRepository(TransactionRecord).save({ name: 'healthy' });
		expect(await names()).toEqual(['healthy']);
	});

	it('never suppresses a legitimate manual rollback after a failed manual nested start', async () => {
		await shortAcquisitionTimeout();
		let starts = 0;
		database.subscribers.push({
			beforeTransactionStart: () => {
				if (++starts === 2) throw new Error('manual nested start failed');
			},
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'must-rollback' });
				await expect(manager.queryRunner.startTransaction()).rejects.toThrow('manual nested start failed');
				await manager.queryRunner.rollbackTransaction();
				expect(manager.queryRunner.isTransactionActive).toBe(false);
				throw new Error('manual transaction rolled back');
			}),
		).rejects.toThrow('manual transaction rolled back');
		expect(isSqliteTransactionActive(database)).toBe(false);
		expect(await names()).toEqual([]);
		await database.getRepository(TransactionRecord).save({ name: 'after-manual-rollback' });
		expect(await names()).toEqual(['after-manual-rollback']);
	});

	it('keeps borrowed manual runner release inside an operation from ending its transaction', async () => {
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await expect(
			runner.manager.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'borrowed' });
				await runner.release();
				expect(runner.isTransactionActive).toBe(true);
				throw new Error('nested rollback');
			}),
		).rejects.toThrow('nested rollback');
		await runner.rollbackTransaction();
		await runner.release();
		expect(await names()).toEqual([]);
	});

	it('refuses further parent writes after recovery had to abort every nested savepoint', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		let fail = true;
		jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (fail && args[0].startsWith('ROLLBACK TO SAVEPOINT')) {
				fail = false;
				return Promise.reject(new Error('savepoint rollback failed'));
			}
			return original.apply(this, args) as Promise<unknown>;
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'outer' });
				await expect(
					manager.transaction(async (nested) => {
						await nested.save(TransactionRecord, { name: 'nested' });
						throw new Error('inner failure');
					}),
				).rejects.toThrow('inner failure');
				await expect(manager.save(TransactionRecord, { name: 'must-not-autocommit' })).rejects.toThrow(
					'aborted the owning transaction scope',
				);
				throw new Error('outer aborted');
			}),
		).rejects.toThrow('outer aborted');
		await database.getRepository(TransactionRecord).save({ name: 'healthy' });
		expect(await names()).toEqual(['healthy']);
	});

	it('reproduces the upstream singleton while the initialized production factory has independent runners', async () => {
		const upstream = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		try {
			expect(upstream.createQueryRunner()).toBe(upstream.createQueryRunner());
			const results = await Promise.allSettled([
				upstream.transaction(() => Promise.resolve()),
				upstream.transaction(() => Promise.resolve()),
			]);
			expect(results.some((result) => result.status === 'rejected')).toBe(true);
		} finally {
			await upstream.destroy();
		}
		expect(database.createQueryRunner()).not.toBe(database.createQueryRunner());
		expect(AppDataSource).toBeInstanceOf(SqliteDataSource);
	});

	it('installs coordination before transaction-containing startup migrations', async () => {
		const migrated = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			migrations: [CoordinatorProbe1000000000999],
			migrationsRun: true,
			migrationsTransactionMode: 'each',
		});
		try {
			expect(await migrated.query('SELECT name FROM migration_probe')).toEqual([{ name: 'migrated' }]);
			await migrated.undoLastMigration({ transaction: 'each' });
			expect(isSqliteTransactionActive(migrated)).toBe(false);
		} finally {
			await migrated.destroy();
		}
	});

	it.each([
		'BEGIN TRANSACTION',
		' \n\tBEGIN TRANSACTION',
		'-- transaction comment\nBEGIN TRANSACTION',
		'/* transaction comment */ \nROLLBACK',
		'; /* comment */ SAVEPOINT unmanaged',
	])('refuses raw transaction-control SQL that would escape connection ownership: %s', async (query) => {
		await expect(database.query(query)).rejects.toThrow('Use QueryRunner transaction methods');
		await database.getRepository(TransactionRecord).save({ name: 'healthy' });
		expect(await names()).toEqual(['healthy']);
	});

	it('serializes concurrent explicit transactions and never rolls back a different request', async () => {
		const results = await Promise.allSettled(
			Array.from({ length: 30 }, (_, index) =>
				database.transaction(async (manager) => {
					await manager.save(TransactionRecord, { name: `request-${index}` });
					await new Promise<void>((resolve) => setImmediate(resolve));
					if (index % 3 === 0) throw new Error('deliberate rollback');
				}),
			),
		);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(10);
		expect(await names()).toEqual(
			Array.from({ length: 30 }, (_, index) => `request-${index}`)
				.filter((_, index) => index % 3 !== 0)
				.sort(),
		);
		expect(isSqliteTransactionActive(database)).toBe(false);
	});

	it('isolates unrelated reads and nontransactional writes from an open transaction', async () => {
		const started = deferred();
		const finish = deferred();
		const transaction = database.transaction(async (manager) => {
			await manager.save(TransactionRecord, { name: 'rolled-back' });
			started.resolve();
			await finish.promise;
			throw new Error('rollback');
		});
		const rejected = expect(transaction).rejects.toThrow('rollback');
		await started.promise;
		expect(isSqliteTransactionActive(database)).toBe(true);
		let writeFinished = false;
		const write = database
			.getRepository(TransactionRecord)
			.insert({ name: 'unrelated' })
			.then(() => {
				writeFinished = true;
			});
		const read = names();
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(writeFinished).toBe(false);
		finish.resolve();
		await rejected;
		await write;
		expect(await read).not.toContain('rolled-back');
		expect(await names()).toEqual(['unrelated']);
	});

	it('coordinates automatic save transactions, transaction:false saves and persistence hooks', async () => {
		await Promise.all([
			database.getRepository(TransactionRecord).save({ name: 'with-hook' }),
			...Array.from({ length: 20 }, (_, index) =>
				database.getRepository(TransactionRecord).save({ name: `save-${index}` }, { transaction: index % 2 === 0 }),
			),
		]);
		expect(await names()).toHaveLength(22);
		expect(await names()).toContain('hook-record');
	});

	it('uses savepoints for nested same-chain transactions and serializes sibling savepoint scopes', async () => {
		await database.transaction(async (manager) => {
			await manager.save(TransactionRecord, { name: 'outer' });
			await expect(
				manager.transaction(async (nested) => {
					await nested.save(TransactionRecord, { name: 'nested-rollback' });
					throw new Error('nested failure');
				}),
			).rejects.toThrow('nested failure');
			await Promise.all([
				database.transaction(async (nested) => {
					await nested.save(TransactionRecord, { name: 'first-nested' });
					await nested.transaction(async (deeper) => {
						await deeper.save(TransactionRecord, { name: 'deeper' });
					});
				}),
				manager.transaction(async (nested) => {
					await nested.save(TransactionRecord, { name: 'second-nested' });
				}),
			]);
		});
		expect(await names()).toEqual(['deeper', 'first-nested', 'outer', 'second-nested']);
	});

	it('holds a manual query runner transaction through rollback while other runners wait', async () => {
		const first = database.createQueryRunner();
		const second = database.createQueryRunner();
		await first.startTransaction();
		await first.manager.save(TransactionRecord, { name: 'manual-rollback' });
		let secondStarted = false;
		const next = (async () => {
			await second.startTransaction();
			secondStarted = true;
			await second.manager.save(TransactionRecord, { name: 'manual-commit' });
			await second.commitTransaction();
		})();
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(secondStarted).toBe(false);
		await first.rollbackTransaction();
		await next;
		await first.release();
		await second.release();
		expect(await names()).toEqual(['manual-commit']);
	});

	it('rolls back every open savepoint when a manual runner is released', async () => {
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.save(TransactionRecord, { name: 'outer-abandoned' });
		await runner.startTransaction();
		await runner.manager.save(TransactionRecord, { name: 'inner-abandoned' });
		await runner.release();
		await database.getRepository(TransactionRecord).save({ name: 'after-release' });
		expect(await names()).toEqual(['after-release']);
	});

	it('does not let a borrowed global query release its surrounding transaction', async () => {
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'before-global-query' });
				expect(await database.query('SELECT COUNT(*) AS count FROM transaction_record')).toEqual([{ count: 1 }]);
				expect(await names()).toEqual(['before-global-query']);
				await database.getRepository(TransactionRecord).save({ name: 'after-global-query' });
				throw new Error('rollback everything');
			}),
		).rejects.toThrow('rollback everything');
		expect(await names()).toEqual([]);
	});

	it('preserves rollback subscriber notification when SQL cleanup needs its fallback', async () => {
		let rollbacks = 0;
		database.subscribers.push({
			afterTransactionRollback: () => {
				rollbacks++;
			},
		});
		// Capture the original for invocation with each real runner's own `this`.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		let fail = true;
		jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (fail && args[0] === 'ROLLBACK') {
				fail = false;
				return Promise.reject(new Error('rollback SQL failed'));
			}
			return original.apply(this, args) as Promise<unknown>;
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'dirty-cache' });
				throw new Error('failure');
			}),
		).rejects.toThrow('failure');
		expect(rollbacks).toBe(1);
		expect(await names()).toEqual([]);
	});

	it('rejects queued work if the physical connection cannot recover its transaction', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (args[0] === 'ROLLBACK') return Promise.reject(new Error('rollback SQL failed'));
			return original.apply(this, args) as Promise<unknown>;
		});
		const connection = database.driver as unknown as {
			databaseConnection: { run: (sql: string, callback: (error: Error | null) => void) => unknown };
		};
		const originalRun = connection.databaseConnection.run;
		jest.spyOn(connection.databaseConnection, 'run').mockImplementation(function (sql, ...args) {
			if (sql === 'ROLLBACK') {
				(args[0] as (error: Error) => void)(new Error('physical cleanup failed'));
				return this;
			}
			return originalRun.call(this, sql, ...args);
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'uncertain' });
				throw new Error('operation failure');
			}),
		).rejects.toThrow('operation failure');
		await expect(database.getRepository(TransactionRecord).save({ name: 'must-not-join' })).rejects.toThrow(
			'transaction recovery failed',
		);
	});

	it.each(['BEGIN TRANSACTION', 'ROLLBACK'])('recovers a failed %s and permits the next transaction', async (sql) => {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		let fail = true;
		jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (fail && args[0] === sql) {
				fail = false;
				return Promise.reject(new Error(`injected ${sql} failure`));
			}
			return original.apply(this, args) as Promise<unknown>;
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'failed' });
				throw new Error('operation failure');
			}),
		).rejects.toThrow(sql === 'BEGIN TRANSACTION' ? 'injected BEGIN' : 'operation failure');
		expect(isSqliteTransactionActive(database)).toBe(false);
		await database.transaction((manager) => manager.save(TransactionRecord, { name: 'healthy' }));
		expect(await names()).toEqual(['healthy']);
	});

	it('expires inherited async leases and lets detached event work wait for committed state', async () => {
		let detached: Promise<void>;
		const launch = deferred();
		await database.transaction(() => {
			detached = (async () => {
				await launch.promise;
				await database.getRepository(TransactionRecord).save({ name: 'late-callback' });
			})();
			return Promise.resolve();
		});
		await expect(
			database.transaction(async (manager) => {
				await manager.save(TransactionRecord, { name: 'rollback' });
				launch.resolve();
				outsideSqliteTransaction(database, () => {
					void database.getRepository(TransactionRecord).save({ name: 'event-callback' });
				});
				throw new Error('rollback');
			}),
		).rejects.toThrow('rollback');
		await detached;
		expect(await names()).toEqual(['event-callback', 'late-callback']);
	});
});
