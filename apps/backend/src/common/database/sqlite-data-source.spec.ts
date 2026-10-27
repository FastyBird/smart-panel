import { types as nodeTypes } from 'node:util';
import {
	Column,
	DataSource,
	Entity,
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	MigrationInterface,
	PrimaryGeneratedColumn,
	QueryFailedError,
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
	SqliteNoMutationWindow,
	captureSqliteNoMutationWindow,
	createSqliteDataSource,
	hasCurrentSqliteConnectionLease,
	isSqliteTransactionActive,
	observeSqliteOuterOutcome,
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
	all: (query: string, parameters: unknown[], callback: NativeCallback) => unknown;
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

	describe('original native no-mutation window', () => {
		it('contains original-manager writes after actual implicit rollback', async () => {
			await database.manager.query(
				'INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\'), (2, \'retained\')',
			);
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const commits = nativeCommitProbe();
			let original: unknown;
			let window: SqliteNoMutationWindow;
			await expect(
				database.transaction(async (manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					try {
						await manager.query(
							'INSERT OR ROLLBACK INTO "transaction_record" ("id", "name") VALUES (1, \'duplicate\')',
						);
					} catch (error) {
						original = error;
					}
					await manager.query('UPDATE "transaction_record" SET "name"=\'escaped\' WHERE "id"=1').catch(() => undefined);
					await manager
						.query('INSERT INTO "transaction_record" ("id", "name") VALUES (3, \'escaped-insert\')')
						.catch(() => undefined);
				}),
			).rejects.toBeDefined();
			const after = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			console.info('implicit-rollback-native', {
				before,
				after,
				nativeCommits: commits.mock.calls.filter(([sql]) => sql === 'COMMIT').length,
				outcome: window.outcome,
			});
			expect(original).toBeDefined();
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(after).toEqual(before);
		});

		it.each(['body', 'beforeCommit', 'beforeQuery'])('contains native trigger rollback through %s', async (route) => {
			await database.manager.query(
				'INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\'), (2, \'retained\')',
			);
			await database.manager.query(
				"CREATE TRIGGER rollback_candidate BEFORE INSERT ON transaction_record WHEN NEW.id=9 BEGIN SELECT RAISE(ROLLBACK, 'original trigger'); END",
			);
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const commits = nativeCommitProbe();
			let entered = false,
				original: unknown;
			const mutate = async (manager: import('typeorm').EntityManager) => {
				if (entered) return;
				entered = true;
				await manager.query('UPDATE "transaction_record" SET "name"=\'earlier-candidate\' WHERE "id"=2');
				try {
					await manager.query('INSERT INTO "transaction_record" ("id", "name") VALUES (9, \'trigger\')');
				} catch (cause) {
					original = cause;
				}
				await manager.query('UPDATE "transaction_record" SET "name"=\'escape\' WHERE "id"=1').catch(() => undefined);
			};
			database.subscribers.push({
				beforeTransactionCommit: (event) => (route === 'beforeCommit' ? mutate(event.manager) : undefined),
				beforeQuery: (event) =>
					route === 'beforeQuery' && event.query === 'SELECT 29' ? mutate(event.manager) : undefined,
			});
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					if (route === 'body') await mutate(manager);
					if (route === 'beforeQuery') await manager.query('SELECT 29').catch(() => undefined);
				}),
			).rejects.toBeDefined();
			expect(entered).toBe(true);
			expect(original).toBeDefined();
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		});

		it('queues preconnected native B until the real rollback callback and retains original A error before AfterQuery children', async () => {
			const commits = nativeCommitProbe();
			await database.manager.query(
				'INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\'), (2, \'retained\')',
			);
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection & {
				run: NativeConnection['all'];
			};
			const run = native.run;
			const errorArrived = deferred(),
				bEnqueued = deferred();
			let release: () => void;
			let nativeError: Error, originalError: unknown, finalError: { driverError?: { cause?: unknown } };
			const submitted: string[] = [],
				children: Promise<unknown>[] = [];
			const aSql = 'INSERT OR ROLLBACK INTO "transaction_record" ("id", "name") VALUES (1, \'duplicate\')';
			const bSql = 'UPDATE "transaction_record" SET "name"=\'queued-escape\' WHERE "id"=1';
			jest.spyOn(native, 'run').mockImplementation(function (this: unknown, sql, parameters, callback) {
				submitted.push(sql);
				if (!callback) return Reflect.apply(run, this, [sql, parameters]) as unknown;
				return run.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
					if (sql === aSql) {
						nativeError = error;
						release = () => {
							callback.call(this, error, rows);
						};
						errorArrived.resolve();
					} else callback.call(this, error, rows);
				});
			});
			database.subscribers.push({
				afterQuery(event) {
					if (event.query !== aSql || event.success) return;
					const child = event.manager
						.query('INSERT INTO "transaction_record" ("id", "name") VALUES (3, \'reentry\')')
						.catch((cause: unknown) => cause);
					children.push(child);
					return child.then(() => undefined);
				},
			});
			try {
				await database.transaction(async (manager) => {
					const runner = manager.queryRunner;
					const connect = runner.connect.bind(runner) as () => Promise<
						NativeConnection & { run: NativeConnection['all'] }
					>;
					jest.spyOn(runner, 'connect').mockImplementation(async () => {
						const facade = (await connect()) as typeof native;
						return new Proxy(facade, {
							get(target, key) {
								if (key === 'run')
									return (sql: string, parameters: unknown[], callback: NativeCallback) => {
										const result = target.run(sql, parameters, callback);
										if (sql === bSql) {
											expect(result).toBe(native);
											bEnqueued.resolve();
										}
										return result;
									};
								return Reflect.get(target, key) as unknown;
							},
						});
					});
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					const a = manager.query(aSql).catch((cause: unknown) => {
						originalError = cause;
					});
					await errorArrived.promise;
					const b = manager.query(bSql).catch((cause: unknown) => cause);
					try {
						await bEnqueued.promise;
						// Full native timeline is asserted after joining every original query.
					} finally {
						release();
					}
					await a;
					await b;
					await Promise.all(children);
				});
			} catch (cause) {
				finalError = cause as typeof finalError;
			}
			console.info('queued-rollback-native', {
				submitted,
				before,
				after: await database.manager.find(TransactionRecord, { order: { id: 'ASC' } }),
			});
			expect((originalError as { driverError: unknown }).driverError).toBe(nativeError);
			expect(finalError).toHaveProperty('query', 'COMMIT');
			expect(finalError.driverError.cause).toBe(originalError);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(submitted.filter((sql) => sql === bSql || sql.includes('reentry'))).toEqual([]);
			expect(children).toHaveLength(1);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
		});

		it.each(['settled query', 'base connect', 'startup subscriber'])(
			'refuses late capture after %s without retroactive containment claims',
			async (route) => {
				if (route === 'startup subscriber')
					database.subscribers.push({
						afterTransactionStart: (event) => event.manager.query('SELECT 11').then(() => undefined),
					});
				let captureError: unknown;
				await expect(
					database.transaction(async (manager) => {
						if (route === 'settled query') await manager.query('SELECT 11');
						if (route === 'base connect')
							await SqliteQueryRunner.prototype.query.call(manager.queryRunner, 'SELECT 11');
						try {
							captureSqliteNoMutationWindow(manager, () => true);
						} catch (cause) {
							captureError = cause;
						}
					}),
				).rejects.toBeDefined();
				expect(captureError).toEqual(
					new Error('SQLite no-mutation capture must precede candidate query/connect issuance'),
				);
				expect(await names()).toEqual([]);
			},
		);

		it.each([undefined, null, false, 0, '', new Error('original native submission throw')])(
			'preserves delayed native synchronous throw without callback fabrication: %p',
			async (cause) => {
				const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
				const all = native.all,
					arrived = deferred(),
					queued = deferred();
				let release: () => void;
				let callbacks = 0,
					caught: { cause: unknown };
				jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
					if (sql === 'SELECT 72') throw cause as Error;
					return all.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
						if (sql === 'SELECT 71') {
							release = () => {
								callback.call(this, error, rows);
							};
							arrived.resolve();
						} else callback.call(this, error, rows);
					});
				});
				database.subscribers.push({
					afterQuery(event) {
						if (event.query === 'SELECT 72') callbacks++;
					},
				});
				await expect(
					database.transaction(async (manager) => {
						const runner = manager.queryRunner,
							connect = runner.connect.bind(runner) as () => Promise<
								NativeConnection & { run: NativeConnection['all'] }
							>;
						jest.spyOn(runner, 'connect').mockImplementation(async () => {
							const facade = (await connect()) as NativeConnection;
							return new Proxy(facade, {
								get(target, key) {
									if (key === 'all')
										return (sql: string, parameters: unknown[], callback: NativeCallback) => {
											const result = target.all(sql, parameters, callback);
											if (sql === 'SELECT 72') queued.resolve();
											return result;
										};
									return Reflect.get(target, key) as unknown;
								},
							});
						});
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.armUnchanged(window.beginReads());
						const a = manager.query('SELECT 71');
						await arrived.promise;
						const b = manager.query('SELECT 72').catch((error: unknown) => {
							caught = { cause: error };
						});
						try {
							await queued.promise;
						} finally {
							release();
						}
						await a;
						await b;
					}),
				).rejects.toBeDefined();
				expect(caught).toEqual({ cause });
				expect(caught.cause).toBe(cause);
				expect(callbacks).toBe(0);
				await database.transaction(async (manager) => {
					await manager.query('SELECT 1');
				});
			},
		);

		it.each([undefined, null, false, 0, ''])(
			'keeps earlier presence-wrapped child failure primary across native abort: %p',
			async (cause) => {
				await database.manager.query('INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\')');
				const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
				let failure: { driverError: { cause: unknown } };
				try {
					await database.transaction(async (manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.applied();
						await manager.transaction(() => Promise.reject(cause as unknown as Error)).catch(() => undefined);
						await manager
							.query('INSERT OR ROLLBACK INTO "transaction_record" ("id", "name") VALUES (1, \'duplicate\')')
							.catch(() => undefined);
						await manager.query('UPDATE "transaction_record" SET "name"=\'escape\'').catch(() => undefined);
					});
				} catch (error) {
					failure = error as typeof failure;
				}
				expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
				expect(failure.driverError.cause).toBe(cause);
				expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
			},
		);

		it('revalidates the original native method at dequeue before a preconnected write', async () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection & {
				run: NativeConnection['all'];
			};
			const all = native.all,
				run = native.run,
				arrived = deferred(),
				queued = deferred();
			let release: () => void;
			const submitted: string[] = [];
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				return all.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
					if (sql === 'SELECT 81') {
						release = () => {
							callback.call(this, error, rows);
						};
						arrived.resolve();
					} else callback.call(this, error, rows);
				});
			});
			jest.spyOn(native, 'run').mockImplementation(function (this: unknown, sql, parameters, callback) {
				submitted.push(sql);
				return Reflect.apply(run, this, callback ? [sql, parameters, callback] : [sql, parameters]) as unknown;
			});
			const pinned = Object.getOwnPropertyDescriptor(native, 'run');
			await expect(
				database.transaction(async (manager) => {
					const runner = manager.queryRunner,
						connect = runner.connect.bind(runner) as () => Promise<NativeConnection & { run: NativeConnection['all'] }>;
					jest.spyOn(runner, 'connect').mockImplementation(async () => {
						const facade = (await connect()) as typeof native;
						return new Proxy(facade, {
							get(target, key) {
								if (key === 'run')
									return (sql: string, parameters: unknown[], callback: NativeCallback) => {
										const result = target.run(sql, parameters, callback);
										queued.resolve();
										return result;
									};
								return Reflect.get(target, key) as unknown;
							},
						});
					});
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.applied();
					const a = manager.query('SELECT 81');
					await arrived.promise;
					const b = manager
						.query('INSERT INTO "transaction_record" ("name") VALUES (\'must-not-submit\')')
						.catch((cause: unknown) => cause);
					await queued.promise;
					Object.defineProperty(native, 'run', {
						...pinned,
						value: function (...args: unknown[]) {
							return Reflect.apply(run, this, args) as unknown;
						},
					});
					try {
						release();
						await a;
						await b;
					} finally {
						Object.defineProperty(native, 'run', pinned);
					}
				}),
			).rejects.toBeDefined();
			console.info('dequeue-native', { submitted, rows: await database.manager.find(TransactionRecord) });
			expect(submitted.filter((sql) => sql.includes('must-not-submit'))).toEqual([]);
			expect(await database.manager.find(TransactionRecord)).toEqual([]);
		});

		it('keeps queued native structured INSERT and UPDATE results and successful AfterQuery child settlement', async () => {
			const children: Promise<unknown>[] = [];
			database.subscribers.push({
				afterQuery(event) {
					if (event.query === 'SELECT 91') {
						const child = event.manager.query('INSERT INTO "transaction_record" ("name") VALUES (\'child\')');
						children.push(child);
						return child.then(() => undefined);
					}
				},
			});
			await database.transaction(async (manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				const inserts = (await Promise.all([
					manager.queryRunner.query('INSERT INTO "transaction_record" ("name") VALUES (\'a\')', [], true),
					manager.queryRunner.query('INSERT INTO "transaction_record" ("name") VALUES (\'b\')', [], true),
				])) as Array<{ raw: number; affected: number }>;
				expect(inserts.map((result) => result.affected)).toEqual([1, 1]);
				expect(inserts.map((result) => result.raw)).toEqual([1, 2]);
				const updated = (await manager.queryRunner.query(
					'UPDATE "transaction_record" SET "name"=\'updated\'',
					[],
					true,
				)) as { affected: number };
				expect(updated.affected).toBe(2);
				await manager.query('SELECT 91');
				await Promise.all(children);
				window.applied();
			});
			expect(await names()).toEqual(['child', 'updated', 'updated']);
		});

		it.each(['INSERT', 'INSERT OR ROLLBACK'])(
			'contains caught nested terminal failure and full recovery: %s',
			async (insert) => {
				await database.manager.query('INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\')');
				const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
				await expect(
					database.transaction(async (manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.applied();
						await manager
							.transaction(async (nested) => {
								await nested.query('UPDATE "transaction_record" SET "name"=\'candidate\'');
								await nested.query(`${insert} INTO "transaction_record" ("id", "name") VALUES (1, 'duplicate')`);
							})
							.catch(() => undefined);
						await manager.query('INSERT INTO "transaction_record" ("id", "name") VALUES (3, \'escape\')');
					}),
				).rejects.toBeDefined();
				expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
				await database.transaction(async (manager) => {
					await manager.query('SELECT 1');
				});
			},
		);

		it('blocks the original ordinary BUSY retry after another actual native statement aborts', async () => {
			Object.assign(database.options, { busyErrorRetry: 25 });
			await database.manager.query('INSERT INTO "transaction_record" ("id", "name") VALUES (1, \'original\')');
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const all = native.all,
				busy = deferred();
			let submissions = 0,
				submissionsAtTerminal = 0;
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				if (sql === 'SELECT 101') {
					submissions++;
					// Policy-only injection: this is NOT a real native BUSY/rollback proof.
					callback.call(this, new Error('SQLITE_BUSY: explicit retry policy probe'));
					busy.resolve();
					return native;
				}
				return all.call(this, sql, parameters, callback) as unknown;
			});
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.applied();
					const retry = manager.query('SELECT 101').catch((cause: unknown) => cause);
					await busy.promise;
					await manager
						.query('INSERT OR ROLLBACK INTO "transaction_record" ("id", "name") VALUES (1, \'duplicate\')')
						.catch(() => undefined);
					submissionsAtTerminal = submissions;
					await retry;
				}),
			).rejects.toBeDefined();
			expect(submissionsAtTerminal).toBeGreaterThanOrEqual(1);
			expect(submissions).toBe(submissionsAtTerminal);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual([
				{ id: 1, name: 'original' },
			]);
		});

		it('refuses capture while a pre-opt-in original native query is still in flight', async () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const all = native.all,
				arrived = deferred();
			let release: () => void, captureError: unknown;
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				return all.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
					if (sql === 'SELECT 111') {
						release = () => {
							callback.call(this, error, rows);
						};
						arrived.resolve();
					} else callback.call(this, error, rows);
				}) as unknown;
			});
			await expect(
				database.transaction(async (manager) => {
					const issued = manager.query('SELECT 111');
					await arrived.promise;
					try {
						captureSqliteNoMutationWindow(manager, () => true);
					} catch (cause) {
						captureError = cause;
					} finally {
						release();
					}
					await issued;
				}),
			).rejects.toBeDefined();
			expect(captureError).toEqual(
				new Error('SQLite no-mutation capture must precede candidate query/connect issuance'),
			);
		});

		it('cancels queued native work on destroy without lending the held original callback to a successor', async () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const all = native.all,
				arrived = deferred(),
				queued = deferred();
			let release: () => void,
				callbacks = 0;
			const submitted: string[] = [];
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				submitted.push(sql);
				return all.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
					if (sql === 'SELECT 121') {
						release = () => {
							callbacks++;
							callback.call(this, error, rows);
						};
						arrived.resolve();
					} else callback.call(this, error, rows);
				}) as unknown;
			});
			await expect(
				database.transaction(async (manager) => {
					const runner = manager.queryRunner,
						connect = runner.connect.bind(runner) as () => Promise<NativeConnection>;
					jest.spyOn(runner, 'connect').mockImplementation(async () => {
						const facade = await connect();
						return new Proxy(facade, {
							get(target, key) {
								if (key === 'all')
									return (sql: string, parameters: unknown[], callback: NativeCallback) => {
										const result = target.all(sql, parameters, callback);
										if (sql === 'SELECT 122') queued.resolve();
										return result;
									};
								return Reflect.get(target, key) as unknown;
							},
						});
					});
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					const a = manager.query('SELECT 121');
					await arrived.promise;
					const b = manager.query('SELECT 122').catch((cause: unknown) => cause);
					await queued.promise;
					try {
						await database.destroy();
					} finally {
						release();
					}
					await a;
					await b;
				}),
			).rejects.toBeDefined();
			expect(callbacks).toBe(1);
			expect(submitted).not.toContain('SELECT 122');
			const fresh = await createSqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				entities: [TransactionRecord],
				synchronize: true,
			});
			try {
				await fresh.transaction(async (manager) => {
					await manager.insert(TransactionRecord, { name: 'fresh' });
				});
				expect(await fresh.manager.find(TransactionRecord)).toEqual([{ id: 1, name: 'fresh' }]);
			} finally {
				await fresh.destroy();
			}
		});

		const nativeCommitProbe = () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const original = native.all;
			return jest.spyOn(native, 'all').mockImplementation(function (this: unknown, ...args) {
				return original.apply(this, args) as unknown;
			});
		};
		it.each([
			'SELECT 1',
			'SELECT "id", "name" FROM "transaction_record" WHERE "id" = ? ORDER BY "id" DESC LIMIT 1',
			'SELECT COUNT(DISTINCT "id") AS "total" FROM "transaction_record" WHERE ("id" BETWEEN 0 AND 100) OR "name" IS NULL',
			'SELECT "r"."id" FROM "transaction_record" "r" LEFT JOIN "transaction_record" "other" ON "r"."id" = "other"."id" WHERE "r"."id" IN (SELECT "id" FROM "transaction_record")',
			'SELECT \'can\'\'t;write\' AS "literal", (1 + 2) * 3 AS "value"',
		])('admits the complete safe native read grammar: %s', async (sql) => {
			const commits = nativeCommitProbe();
			let window: SqliteNoMutationWindow;
			await database.transaction(async (manager) => {
				window = captureSqliteNoMutationWindow(manager, () => true);
				await window.reserveZeroRows('transaction_record', 'id');
				const checkpoint = window.beginReads();
				await manager.query(sql, sql.includes('?') ? [1] : []);
				await manager.find(TransactionRecord);
				window.armUnchanged(checkpoint);
				await manager.query('SELECT 1'); // original final graph/benign callback read remains possible
			});
			expect(window.outcome).toBe('committed');
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
		});

		it.each([
			'UPDATE "transaction_record" SET "name"=\'changed\' WHERE 0',
			'UPDATE "transaction_record" SET "name"=\'changed\'',
			'UPDATE missing_table SET value=1',
			'REPLACE INTO "transaction_record" ("id", "name") VALUES (1, \'replacement\')',
			'WITH candidate AS (SELECT 1) SELECT * FROM candidate',
			'CREATE TABLE attempted_tail (id INTEGER)',
			'PRAGMA user_version=123',
			'SELECT 1; SELECT 2',
			'SELECT /* unknown */ 1',
			'SELECT 1--2',
			'SELECT abs(1)',
			'SELECT "count"(*) FROM "transaction_record"',
			"SELECT * FROM pragma_table_info('transaction_record')",
		])('retains caught/failed/no-row/unknown native attempt: %s', async (sql) => {
			await database.manager.save(TransactionRecord, { name: 'original' });
			const before = await database.manager.find(TransactionRecord);
			const commits = nativeCommitProbe();
			let window: SqliteNoMutationWindow;
			await expect(
				database.transaction(async (manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					const checkpoint = window.beginReads();
					window.armUnchanged(checkpoint);
					try {
						await manager.query(sql);
					} catch {
						/* caught does not erase the attempted query */
					}
				}),
			).rejects.toBeDefined();
			expect(['refused', 'rolled_back']).toContain(window.outcome);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(await database.manager.find(TransactionRecord)).toEqual(before);
			await database.transaction((manager) => {
				const next = captureSqliteNoMutationWindow(manager, () => true);
				next.armUnchanged(next.beginReads());
				return Promise.resolve();
			});
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
		});

		it.each(
			[
				'COMMIT',
				'END',
				'END TRANSACTION',
				' commit ',
				'/* control */ cOmMiT',
				'-- control\nCOMMIT',
				'ROLLBACK',
			].flatMap((sql) =>
				['before-commit', 'before-query'].flatMap((boundary) =>
					['manager', 'base-query'].map((route) => ({ sql, boundary, route })),
				),
			),
		)(
			'rejects unauthorized native transaction control: $sql / $boundary / $route',
			async ({ sql, boundary, route }) => {
				await database.manager.save(TransactionRecord, { name: 'original' });
				const before = await database.manager.find(TransactionRecord);
				const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
				const original = native.all;
				const submitted: string[] = [];
				let entered = false,
					attacking = false,
					blocked: { cause: unknown } | undefined;
				jest.spyOn(native, 'all').mockImplementation(function (this: unknown, ...args) {
					if (attacking) submitted.push(args[0]);
					return original.apply(this, args) as unknown;
				});
				const attack = async (manager: QueryRunner['manager']) => {
					if (entered) return;
					entered = true;
					await manager.query('UPDATE "transaction_record" SET "name"=?', ['changed']);
					attacking = true;
					try {
						if (route === 'manager') await manager.query(sql);
						else await SqliteQueryRunner.prototype.query.call(manager.queryRunner, sql);
					} catch (cause: unknown) {
						blocked = { cause };
					} finally {
						attacking = false;
					}
					if (sql === 'ROLLBACK') await manager.insert(TransactionRecord, { name: 'after-rollback' });
				};
				database.subscribers.push({
					async beforeTransactionCommit(event) {
						if (boundary === 'before-commit') await attack(event.manager);
					},
					async beforeQuery(event) {
						if (boundary === 'before-query' && event.query === 'COMMIT') await attack(event.manager);
					},
				});
				await expect(
					database.transaction((manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.armUnchanged(window.beginReads());
						return Promise.resolve();
					}),
				).rejects.toBeDefined();
				expect(entered).toBe(true);
				expect(blocked?.cause).toBeInstanceOf(Error);
				expect(submitted).toEqual([]);
				expect(await database.manager.find(TransactionRecord)).toEqual(before);
				await database.transaction((manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				});
				expect(await database.manager.find(TransactionRecord)).toEqual(before);
			},
		);

		it.each(
			[false, true].flatMap((guard) => [
				{ guard, kind: 'false', cause: undefined },
				...[undefined, null, false, 0, '', new Error('original owner')].map((cause) => ({
					guard,
					kind: 'throw',
					cause,
				})),
			]),
		)('keeps initial capture refusal nonremovable: %p', async ({ guard, kind, cause }) => {
			const commits = nativeCommitProbe();
			let captured: SqliteCommitGuardRefusedError, failure: { driverError: SqliteCommitGuardRefusedError };
			let receipt: SqliteCommitGuardReceipt;
			try {
				await database.transaction(async (manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					if (guard) registerSqliteCommitGuard(manager, () => true);
					try {
						captureSqliteNoMutationWindow(manager, () => {
							if (kind === 'throw') throw cause as Error;
							return false;
						});
					} catch (error: unknown) {
						captured = error as SqliteCommitGuardRefusedError;
					}
					await manager.insert(TransactionRecord, { name: 'must-rollback' });
				});
			} catch (error: unknown) {
				failure = error as typeof failure;
			}
			expect(captured).toBeInstanceOf(SqliteCommitGuardRefusedError);
			if (kind === 'throw') expect(captured.cause).toBe(cause);
			expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
			expect(failure.driverError.cause).toBe(captured.cause);
			expect(receipt.outcome).toBe('refused');
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(await names()).toEqual([]);
			await database.transaction((manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				window.armUnchanged(window.beginReads());
				return Promise.resolve();
			});
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
		});

		it.each(['detached owner', 'manual runner'].flatMap((mode) => [false, true].map((guard) => ({ mode, guard }))))(
			'keeps failed guard registration nonremovable: $mode, preexisting guard=$guard',
			async ({ mode, guard }) => {
				await database.manager.save(TransactionRecord, [{ name: 'original-one' }, { name: 'original-two' }]);
				const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
				const commits = nativeCommitProbe();
				let captured: unknown, returned: SqliteNoMutationWindow | undefined;
				let receipt: SqliteCommitGuardReceipt, failure: { driverError: SqliteCommitGuardRefusedError };
				let ownerCalls = 0;
				const exercise = async (manager: QueryRunner['manager']) => {
					receipt = observeSqliteOuterOutcome(manager);
					if (guard && mode === 'detached owner') registerSqliteCommitGuard(manager, () => true);
					const capture = () =>
						captureSqliteNoMutationWindow(manager, () => {
							ownerCalls++;
							return true;
						});
					try {
						returned = mode === 'detached owner' ? outsideSqliteTransaction(database, capture) : capture();
					} catch (cause: unknown) {
						captured = cause;
					}
					expect(captured).toBeInstanceOf(Error);
					expect(returned).toBeUndefined();
					expect(() => captureSqliteNoMutationWindow(manager, () => true)).toThrow('already exists');
					await manager.query('UPDATE "transaction_record" SET "name"=?', ['changed']);
					await manager.insert(TransactionRecord, { name: 'must-rollback' });
				};
				if (mode === 'manual runner') {
					const runner = database.createQueryRunner();
					try {
						await runner.startTransaction();
						if (guard) {
							const observer: EntitySubscriberInterface = {
								beforeQuery(event) {
									if (event.query === 'SELECT 17') registerSqliteCommitGuard(event.manager, () => true);
								},
							};
							database.subscribers.push(observer);
							try {
								await runner.manager.query('SELECT 17');
							} finally {
								database.subscribers.splice(database.subscribers.indexOf(observer), 1);
							}
						}
						await exercise(runner.manager);
						try {
							await runner.commitTransaction();
						} catch (cause: unknown) {
							failure = cause as typeof failure;
						}
					} finally {
						if (runner.isTransactionActive) await runner.rollbackTransaction();
						await runner.release();
					}
				} else {
					try {
						await database.transaction(exercise);
					} catch (cause: unknown) {
						failure = cause as typeof failure;
					}
				}
				expect(ownerCalls).toBe(0);
				expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
				expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
				expect(failure.driverError.cause).toBe(captured);
				expect(receipt.outcome).toBe('refused');
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
				expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
				await database.transaction((manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				});
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
			},
		);

		it('keeps a caught dispatch-pin capture error guarded without invoking its accessor', async () => {
			const commits = nativeCommitProbe();
			let getterCalls = 0,
				captured: unknown,
				failure: { driverError: SqliteCommitGuardRefusedError };
			try {
				await database.transaction(async (manager) => {
					const descriptor = Object.getOwnPropertyDescriptor(manager, 'query'),
						original: unknown = Reflect.get(manager, 'query');
					Object.defineProperty(manager, 'query', {
						configurable: true,
						get() {
							getterCalls++;
							return original;
						},
					});
					try {
						captureSqliteNoMutationWindow(manager, () => true);
					} catch (cause: unknown) {
						captured = cause;
					} finally {
						if (descriptor) Object.defineProperty(manager, 'query', descriptor);
						else Reflect.deleteProperty(manager, 'query');
					}
					await manager.insert(TransactionRecord, { name: 'must-rollback' });
				});
			} catch (cause: unknown) {
				failure = cause as typeof failure;
			}
			expect(captured).toBeInstanceOf(Error);
			expect(getterCalls).toBe(0);
			expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(failure.driverError.cause).toBe(captured);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(await names()).toEqual([]);
		});

		it.each(['remove-restore', 'method-restore'] as const)(
			'refuses original-manager writes after exact observer restoration: %s',
			async (mode) => {
				await database.manager.save(TransactionRecord, { name: 'original' });
				const before = await database.manager.find(TransactionRecord),
					commits = nativeCommitProbe();
				const observer: EntitySubscriberInterface = { beforeQuery: () => undefined };
				let entered = false,
					restored = false,
					candidate: QueryRunner['manager'];
				database.subscribers.push(observer, {
					async beforeTransactionCommit(event) {
						if (entered) return;
						entered = true;
						expect(event.manager).toBe(candidate);
						expect(event.queryRunner).toBe(candidate.queryRunner);
						expect(event.connection).toBe(database);
						const index = database.subscribers.indexOf(observer);
						const descriptor = Object.getOwnPropertyDescriptor(observer, 'beforeQuery');
						if (mode === 'remove-restore') database.subscribers.splice(index, 1);
						else observer.beforeQuery = () => undefined;
						try {
							await event.manager.query('UPDATE "transaction_record" SET "name"=?', ['changed']);
						} finally {
							if (mode === 'remove-restore') database.subscribers.splice(index, 0, observer);
							else Object.defineProperty(observer, 'beforeQuery', descriptor);
							restored = true;
						}
					},
				});
				const order = [...database.subscribers],
					descriptor = Object.getOwnPropertyDescriptor(observer, 'beforeQuery');
				await expect(
					database.transaction((manager) => {
						candidate = manager;
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.armUnchanged(window.beginReads());
						return Promise.resolve();
					}),
				).rejects.toBeDefined();
				expect(restored).toBe(true);
				expect(database.subscribers).toEqual(order);
				expect(Object.getOwnPropertyDescriptor(observer, 'beforeQuery')).toEqual(descriptor);
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
				expect(await database.manager.find(TransactionRecord)).toEqual(before);
				await database.transaction((manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				});
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
			},
		);

		it.each(['commit', 'rollback'] as const)(
			'preserves opted-in APPLIED nested %s and original callback reads',
			async (mode) => {
				let reads = 0;
				let afterAck = 0;
				database.subscribers.push({
					async beforeTransactionCommit(event) {
						await event.manager.query('SELECT 1');
						reads++;
					},
					async afterTransactionCommit(event) {
						if (!event.queryRunner.isTransactionActive) {
							await event.manager.query('SELECT 1');
							afterAck++;
						}
					},
				});
				await database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.beginReads();
					if (mode === 'rollback') {
						await manager.queryRunner.startTransaction();
						try {
							await manager.insert(TransactionRecord, { name: 'applied' });
						} finally {
							await manager.queryRunner.rollbackTransaction();
						}
					} else {
						await manager.transaction(async (nested) => {
							await nested.insert(TransactionRecord, { name: 'applied' });
						});
					}
					window.applied();
				});
				expect(await names()).toEqual(mode === 'commit' ? ['applied'] : []);
				expect(reads).toBe(mode === 'commit' ? 2 : 1);
				expect(afterAck).toBe(1);
			},
		);

		it('keeps a caught nested body failure sticky for the opted-in APPLIED branch', async () => {
			const originalFailure = new Error('original nested body failure'),
				commits = nativeCommitProbe();
			let failure: { driverError: SqliteCommitGuardRefusedError };
			try {
				await database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.applied();
					try {
						await manager.transaction(async (nested) => {
							await nested.insert(TransactionRecord, { name: 'must-rollback' });
							throw originalFailure;
						});
					} catch (cause: unknown) {
						expect(cause).toBe(originalFailure);
					}
				});
			} catch (cause: unknown) {
				failure = cause as typeof failure;
			}
			expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(failure.driverError.cause).toBe(originalFailure);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			expect(await names()).toEqual([]);
		});

		it.each(['query-forward', 'base-query', 'broadcast-forward'] as const)(
			'retains temporary original dispatch replacement and exact restoration: %s',
			async (fault) => {
				await database.manager.save(TransactionRecord, { name: 'original' });
				const before = await database.manager.find(TransactionRecord),
					commits = nativeCommitProbe();
				let restored = false;
				await expect(
					database.transaction(async (manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => true),
							checkpoint = window.beginReads();
						window.armUnchanged(checkpoint);
						const runner = manager.queryRunner;
						const target = fault === 'broadcast-forward' ? runner.broadcaster : runner;
						const key = fault === 'broadcast-forward' ? 'broadcast' : 'query';
						const descriptor = Object.getOwnPropertyDescriptor(target, key);
						const original = Reflect.get(target, key) as (...args: unknown[]) => unknown;
						Reflect.set(
							target,
							key,
							fault === 'base-query'
								? (Reflect.get(SqliteQueryRunner.prototype, 'query') as unknown)
								: function (this: unknown, ...args: unknown[]) {
										return original.apply(this, args) as unknown;
									},
						);
						try {
							await manager.query('UPDATE "transaction_record" SET "name"=?', ['changed']);
						} finally {
							if (descriptor) Object.defineProperty(target, key, descriptor);
							else Reflect.deleteProperty(target, key);
							restored = true;
						}
					}),
				).rejects.toBeDefined();
				expect(restored).toBe(true);
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
				expect(await database.manager.find(TransactionRecord)).toEqual(before);
			},
		);

		it('does not lend the one-shot zero-row reservation to an identical callback query', async () => {
			let entered = false;
			database.subscribers.push({
				async beforeQuery(event) {
					if (entered || !event.query.endsWith('WHERE 0')) return;
					entered = true;
					await event.manager.query(event.query);
				},
			});
			const commits = nativeCommitProbe();
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					await window.reserveZeroRows('transaction_record', 'id');
					window.armUnchanged(window.beginReads());
				}),
			).rejects.toBeDefined();
			expect(entered).toBe(true);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		});

		it.each([false, true])('rechecks the same native BUSY ticket (caught intervening attempt=%s)', async (mutate) => {
			Object.assign(database.options, { busyErrorRetry: 1 });
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const original = native.all;
			let attempts = 0;
			let candidate: QueryRunner;
			let window: SqliteNoMutationWindow;
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				if (sql === 'COMMIT' && ++attempts === 1) {
					void (async () => {
						if (mutate) {
							try {
								await candidate.query('UPDATE "transaction_record" SET "name"=\'late\' WHERE 0');
							} catch {
								/* sealed attempt is still sticky */
							}
						}
						callback.call(this, new Error('SQLITE_BUSY: original retry probe'));
					})();
					return this;
				}
				return original.call(this, sql, parameters, callback) as unknown;
			});
			const result = database.transaction((manager) => {
				candidate = manager.queryRunner;
				window = captureSqliteNoMutationWindow(manager, () => true);
				window.armUnchanged(window.beginReads());
				return Promise.resolve();
			});
			if (mutate) await expect(result).rejects.toBeDefined();
			else await result;
			expect(window.outcome).toBe(mutate ? 'refused' : 'committed');
			expect(attempts).toBe(mutate ? 1 : 2);
		});

		it('waits for real native ACK then permits original post-ACK mutation callbacks', async () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const original = native.all,
				entered = deferred(),
				resume = deferred();
			let completed = false,
				window: SqliteNoMutationWindow;
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				if (sql !== 'COMMIT') return original.call(this, sql, parameters, callback) as unknown;
				return original.call(this, sql, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
					entered.resolve();
					void resume.promise.then(() => {
						callback.call(this, error, rows);
					});
				});
			});
			database.subscribers.push({
				async afterTransactionCommit(event) {
					await event.manager.query('INSERT INTO "transaction_record" ("name") VALUES (?)', ['post-ack']);
				},
			});
			const result = database
				.transaction((manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				})
				.then(() => {
					completed = true;
				});
			try {
				await entered.promise;
				expect(window.outcome).toBe('unknown');
				expect(completed).toBe(false);
			} finally {
				resume.resolve();
			}
			await result;
			expect(window.outcome).toBe('committed');
			expect(await names()).toEqual(['post-ack']);
		});

		it.each([undefined, null, false, 0, ''])('retains original falsy post-ACK failure %s', async (cause) => {
			let window: SqliteNoMutationWindow;
			database.subscribers.push({
				afterTransactionCommit() {
					throw cause as unknown as Error;
				},
			});
			let failure: { cause: unknown } | undefined;
			try {
				await database.transaction((manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				});
			} catch (cause: unknown) {
				failure = { cause };
			}
			expect(failure).toEqual({ cause });
			expect(window.outcome).toBe('committed');
		});

		it.each(['error', 'throw'] as const)('does not promote submitted native %s to ACK', async (fault) => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection,
				original = native.all;
			let window: SqliteNoMutationWindow;
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				if (sql === 'COMMIT') {
					if (fault === 'throw') throw false as unknown as Error;
					callback.call(this, new Error('lost native ACK'));
					return this;
				}
				return original.call(this, sql, parameters, callback) as unknown;
			});
			await expect(
				database.transaction((manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				}),
			).rejects.toBeDefined();
			expect(window.outcome).toBe('unknown');
			expect(await names()).toEqual([]); // matching rows cannot upgrade outcome
		});

		it('refuses a checkpoint with a still-issued original native read and joins that read', async () => {
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection,
				original = native.all;
			const entered = deferred(),
				resume = deferred();
			jest.spyOn(native, 'all').mockImplementation(function (this: unknown, sql, parameters, callback) {
				if (sql !== 'SELECT 42') return original.call(this, sql, parameters, callback) as unknown;
				entered.resolve();
				void resume.promise.then(() => {
					original.call(this, sql, parameters, callback);
				});
				return this;
			});
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true),
						read = manager.query('SELECT 42');
					try {
						await entered.promise;
						expect(() => window.beginReads()).toThrow(SqliteCommitGuardRefusedError);
					} finally {
						resume.resolve();
						await read;
					}
				}),
			).rejects.toBeDefined();
		});

		it('retains first-read callback mutation and cannot rebase the checkpoint', async () => {
			let entered = false;
			database.subscribers.push({
				async beforeQuery(event) {
					if (entered || event.query !== 'SELECT 42') return;
					entered = true;
					await event.manager.query('UPDATE "transaction_record" SET "name"=\'drift\' WHERE 0');
				},
			});
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true),
						checkpoint = window.beginReads();
					await manager.query('SELECT 42');
					expect(() => window.armUnchanged(checkpoint)).toThrow(SqliteCommitGuardRefusedError);
					expect(() => window.beginReads()).toThrow(SqliteCommitGuardRefusedError);
				}),
			).rejects.toBeDefined();
			expect(entered).toBe(true);
		});

		it('retains nested savepoint/depth history even after original depth and rows are restored', async () => {
			const commits = nativeCommitProbe();
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true),
						checkpoint = window.beginReads();
					await manager.queryRunner.startTransaction();
					await manager.query('INSERT INTO "transaction_record" ("name") VALUES (\'nested\')');
					await manager.queryRunner.rollbackTransaction();
					expect(await manager.find(TransactionRecord)).toEqual([]);
					expect(() => window.armUnchanged(checkpoint)).toThrow(SqliteCommitGuardRefusedError);
				}),
			).rejects.toBeDefined();
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		});

		it.each(['SELECT 1', 'UPDATE "transaction_record" SET "name"=\'late\' WHERE 0'])(
			'checks attempted queries again after pure guards: %s',
			async (sql) => {
				const commits = nativeCommitProbe();
				let issued: Promise<unknown>;
				let rejected: { cause: unknown };
				let failure: { driverError: SqliteCommitGuardRefusedError };
				try {
					await database.transaction((manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => true);
						window.armUnchanged(window.beginReads());
						registerSqliteCommitGuard(manager, () => {
							issued = manager.queryRunner.query(sql).catch((cause: unknown) => {
								rejected = { cause };
							});
							return true;
						});
						return Promise.resolve();
					});
				} catch (cause: unknown) {
					failure = cause as typeof failure;
				}
				await issued;
				expect(rejected?.cause).toBeInstanceOf(Error);
				expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
				expect(failure.driverError.cause).toBe(rejected.cause);
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			},
		);

		it.each([
			{ boundary: 'guard', sql: 'SELECT 1' },
			{ boundary: 'guard', sql: 'UPDATE "transaction_record" SET "name"=\'forbidden\' WHERE 0' },
			{ boundary: 'body', sql: 'END' },
			{ boundary: 'before-commit', sql: 'END' },
		])('vetoes APPLIED caught entry failure: $boundary / $sql', async ({ boundary, sql }) => {
			await database.manager.insert(TransactionRecord, { name: 'original' });
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const commits = nativeCommitProbe();
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection & {
				run: NativeConnection['all'];
			};
			const runs = jest.spyOn(native, 'run');
			let window: SqliteNoMutationWindow;
			let issued: Promise<unknown> | undefined;
			let rejected: { cause: unknown } | undefined;
			let failure: { query: string; driverError: SqliteCommitGuardRefusedError } | undefined;
			const attempt = (manager: QueryRunner['manager']) =>
				manager.queryRunner.query(sql).catch((cause: unknown) => {
					rejected = { cause };
				});
			const subscriber: EntitySubscriberInterface = {
				async beforeTransactionCommit(event) {
					await attempt(event.manager);
				},
			};
			if (boundary === 'before-commit') database.subscribers.push(subscriber);
			try {
				await database.transaction(async (manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					await manager.insert(TransactionRecord, { name: 'candidate' });
					window.applied();
					if (boundary === 'guard') {
						registerSqliteCommitGuard(manager, () => {
							issued = attempt(manager);
							return true;
						});
					} else if (boundary === 'body') {
						await attempt(manager);
					}
				});
			} catch (cause: unknown) {
				failure = cause as typeof failure;
			} finally {
				await issued;
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
			}
			expect(rejected?.cause).toBeInstanceOf(Error);
			expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(failure.query).toBe('COMMIT');
			expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
			expect(failure.driverError.cause).toBe(rejected.cause);
			expect(window.outcome).toBe('refused');
			expect(commits.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect([...commits.mock.calls, ...runs.mock.calls].filter(([query]) => query === sql)).toHaveLength(0);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
			await database.transaction((manager) => {
				const next = captureSqliteNoMutationWindow(manager, () => true);
				next.armUnchanged(next.beginReads());
				return Promise.resolve();
			});
			expect(commits.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(1);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
		});

		it.each(
			['body', 'before-commit', 'guard'].flatMap((boundary) =>
				['base-query', 'manager-forward'].flatMap((route) =>
					['END', 'SELECT 1'].map((sql) => ({ boundary, route, sql })),
				),
			),
		)('vetoes APPLIED base refusal: $boundary / $route / $sql', async ({ boundary, route, sql }) => {
			await database.manager.insert(TransactionRecord, { name: 'original' });
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const commits = nativeCommitProbe();
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection & {
				run: NativeConnection['all'];
			};
			const runs = jest.spyOn(native, 'run');
			let window: SqliteNoMutationWindow;
			let issued: Promise<unknown> | undefined;
			let rejected: { driverError: SqliteCommitGuardRefusedError } | undefined;
			let failure: { query: string; driverError: SqliteCommitGuardRefusedError } | undefined;
			let restored = route === 'base-query';
			const attempt = async (manager: QueryRunner['manager']) => {
				const runner = manager.queryRunner;
				const descriptor = Object.getOwnPropertyDescriptor(runner, 'query');
				if (route === 'manager-forward')
					Reflect.set(runner, 'query', Reflect.get(SqliteQueryRunner.prototype, 'query'));
				try {
					if (route === 'base-query') await SqliteQueryRunner.prototype.query.call(runner, sql);
					else await manager.query(sql);
				} catch (cause: unknown) {
					rejected = cause as typeof rejected;
				} finally {
					if (route === 'manager-forward') {
						if (descriptor) Object.defineProperty(runner, 'query', descriptor);
						else Reflect.deleteProperty(runner, 'query');
						restored = true;
						expect(Object.getOwnPropertyDescriptor(runner, 'query')).toEqual(descriptor);
					}
				}
			};
			const subscriber: EntitySubscriberInterface = {
				async beforeTransactionCommit(event) {
					await attempt(event.manager);
				},
			};
			if (boundary === 'before-commit') database.subscribers.push(subscriber);
			try {
				await database.transaction(async (manager) => {
					window = captureSqliteNoMutationWindow(manager, () => true);
					await manager.insert(TransactionRecord, { name: 'candidate' });
					window.applied();
					if (boundary === 'guard') {
						registerSqliteCommitGuard(manager, () => {
							issued = attempt(manager);
							return true;
						});
					} else if (boundary === 'body') await attempt(manager);
				});
			} catch (cause: unknown) {
				failure = cause as typeof failure;
			} finally {
				await issued;
				const index = database.subscribers.indexOf(subscriber);
				if (index >= 0) database.subscribers.splice(index, 1);
			}
			expect(restored).toBe(true);
			expect(rejected?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
			expect(failure.query).toBe('COMMIT');
			expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
			expect(failure.driverError.cause).toBe(rejected.driverError);
			expect(window.outcome).toBe('refused');
			expect(commits.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect([...commits.mock.calls, ...runs.mock.calls].filter(([query]) => query === sql)).toHaveLength(0);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
			await database.transaction((manager) => {
				const next = captureSqliteNoMutationWindow(manager, () => true);
				next.armUnchanged(next.beginReads());
				return Promise.resolve();
			});
			expect(commits.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(1);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
		});

		it('refuses foreign checkpoint and expired scope while a new healthy scope remains independent', async () => {
			let old: SqliteNoMutationWindow, foreign: ReturnType<SqliteNoMutationWindow['beginReads']>;
			await database.transaction((manager) => {
				old = captureSqliteNoMutationWindow(manager, () => true);
				foreign = old.beginReads();
				old.armUnchanged(foreign);
				return Promise.resolve();
			});
			expect(() => old.armUnchanged(foreign)).toThrow(SqliteCommitGuardRefusedError);
			await expect(
				database.transaction((manager) => {
					const current = captureSqliteNoMutationWindow(manager, () => true);
					current.beginReads();
					current.armUnchanged(foreign);
					return Promise.resolve();
				}),
			).rejects.toBeDefined();
			await database.transaction((manager) => {
				const current = captureSqliteNoMutationWindow(manager, () => true);
				current.armUnchanged(current.beginReads());
				return Promise.resolve();
			});
		});

		it('joins original two-wave benign callback reads and does not lend control text to callbacks', async () => {
			let phase: 'reads' | 'forged' = 'reads',
				entered = false,
				waves = 0;
			const issued: Promise<unknown>[] = [];
			database.subscribers.push({
				async beforeQuery(event) {
					if (entered || event.query !== 'COMMIT') return;
					entered = true;
					if (phase === 'reads') {
						issued.push(event.manager.query('SELECT 1'));
					} else {
						try {
							await event.manager.query('COMMIT');
						} catch {
							/* private control ticket is not inherited */
						}
					}
				},
				afterQuery(event) {
					if (phase !== 'reads') return;
					if (event.query === 'SELECT 1') {
						waves++;
						issued.push(event.manager.query('SELECT 2'));
					}
					if (event.query === 'SELECT 2') waves++;
				},
			});
			const commits = nativeCommitProbe();
			await database.transaction((manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				window.armUnchanged(window.beginReads());
				return Promise.resolve();
			});
			expect(waves).toBe(2);
			await Promise.all(issued);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
			phase = 'forged';
			entered = false;
			commits.mockClear();
			await expect(
				database.transaction((manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					return Promise.resolve();
				}),
			).rejects.toBeDefined();
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		});

		it('rolls back actual trigger effects with their initiating mutation attempt', async () => {
			await database.query(
				"CREATE TRIGGER no_mutation_probe AFTER INSERT ON transaction_record BEGIN UPDATE transaction_record SET name='triggered'; END",
			);
			const commits = nativeCommitProbe();
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					await manager.query("INSERT INTO transaction_record(name) VALUES ('original')");
					expect((await manager.find(TransactionRecord))[0].name).toBe('triggered');
				}),
			).rejects.toBeDefined();
			expect(await names()).toEqual([]);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
		});

		it.each(['owner', 'manager', 'physical'] as const)(
			'refuses temporary original %s drift before restoration',
			async (fault) => {
				let current = true;
				const commits = nativeCommitProbe();
				await expect(
					database.transaction(async (manager) => {
						const window = captureSqliteNoMutationWindow(manager, () => current),
							checkpoint = window.beginReads();
						window.armUnchanged(checkpoint);
						const driver = database.driver as SqliteDriver;
						const physical: unknown = driver.databaseConnection;
						const connection = manager.connection;
						if (fault === 'owner') current = false;
						if (fault === 'manager') Reflect.set(manager, 'connection', {});
						if (fault === 'physical') driver.databaseConnection = Object.create(physical as object) as unknown;
						try {
							await manager.queryRunner.query('SELECT 1');
						} catch {
							/* refusal remains sticky */
						} finally {
							current = true;
							Reflect.set(manager, 'connection', connection);
							driver.databaseConnection = physical;
						}
					}),
				).rejects.toBeDefined();
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			},
		);

		it.each([undefined, null, false, 0, ''])(
			'keeps original caught child cause %s ahead of later owner refusal',
			async (cause) => {
				let current = true,
					window: SqliteNoMutationWindow;
				const commits = nativeCommitProbe();
				database.subscribers.push({
					beforeQuery(event) {
						if (event.query === 'SELECT 77') throw cause as unknown as Error;
					},
				});
				let failure: { driverError: Error & { cause: unknown } } | undefined;
				try {
					await database.transaction(async (manager) => {
						window = captureSqliteNoMutationWindow(manager, () => current);
						window.armUnchanged(window.beginReads());
						try {
							await manager.query('SELECT 77');
						} catch {
							/* the original coordinator owns the first failure */
						}
						current = false;
					});
				} catch (error: unknown) {
					failure = error as typeof failure;
				}
				expect(failure?.driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
				expect(Object.hasOwn(failure.driverError, 'cause')).toBe(true);
				expect(failure.driverError.cause).toBe(cause);
				expect(window.outcome).toBe('refused');
				expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			},
		);

		it('refuses bounded witness exhaustion without wrapping or disturbing the next native scope', async () => {
			const commits = nativeCommitProbe();
			let attempts: { attempts: bigint };
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true);
					window.armUnchanged(window.beginReads());
					// Test-only boundary injection, not an exported epoch or application authority.
					attempts = (Reflect.get(manager.queryRunner, 'guardedCommit') as { noMutation: { attempts: bigint } })
						.noMutation;
					attempts.attempts = (1n << 64n) - 1n;
					await manager.query('SELECT 1');
				}),
			).rejects.toBeDefined();
			expect(attempts.attempts).toBe((1n << 64n) - 1n);
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
			await database.transaction((manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				window.armUnchanged(window.beginReads());
				return Promise.resolve();
			});
			expect(commits.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
		});

		it('cannot erase a refused unchanged decision by choosing applied', async () => {
			await expect(
				database.transaction(async (manager) => {
					const window = captureSqliteNoMutationWindow(manager, () => true),
						checkpoint = window.beginReads();
					await manager.query('UPDATE "transaction_record" SET "name"=\'x\' WHERE 0');
					expect(() => window.armUnchanged(checkpoint)).toThrow(SqliteCommitGuardRefusedError);
					expect(() => window.applied()).toThrow(SqliteCommitGuardRefusedError);
				}),
			).rejects.toBeDefined();
		});
	});

	describe('guarded original lease completion and queued full abort', () => {
		function timeline(beforeSubmit?: (sql: string) => void) {
			const events: string[] = [];
			const native = (database.driver as SqliteDriver).databaseConnection as Record<
				'run' | 'all',
				(...args: unknown[]) => unknown
			>;
			const restores: (() => void)[] = [];
			for (const method of ['run', 'all'] as const) {
				const original = native[method];
				const spy = jest.spyOn(native, method).mockImplementation(function (this: unknown, ...args: unknown[]) {
					const sql = args[0] as string;
					const label = sql.includes("VALUES ('wave-two')")
						? 'wave-two'
						: sql.includes("VALUES ('wave-one')")
							? 'wave-one'
							: sql;
					events.push(`submit:${label}`);
					beforeSubmit?.(sql);
					const callback = args[args.length - 1] as (...values: unknown[]) => unknown;
					args[args.length - 1] = function (this: unknown, ...values: unknown[]) {
						events.push(`callback:${label}`);
						try {
							return Reflect.apply(callback, this, values);
						} finally {
							events.push(`returned:${label}`);
						}
					};
					return Reflect.apply(original, this, args);
				});
				restores.push(() => spy.mockRestore());
			}
			return { events, restore: () => restores.reverse().forEach((restore) => restore()) };
		}

		it.each([false, true])(
			'joins actual wave-two callback before guard and native control, guard=%s',
			async (allow) => {
				const probe = timeline();
				const firstEntered = deferred(),
					firstRelease = deferred(),
					secondEntered = deferred(),
					secondRelease = deferred();
				let one: Promise<unknown>, two: Promise<unknown>;
				const guard = jest.fn(() => {
					probe.events.push('guard');
					return allow;
				});
				database.subscribers.push({
					beforeQuery: async (event) => {
						if (event.query === 'COMMIT') {
							one = event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-one')");
							void one.catch(() => undefined);
						} else if (event.query.includes("VALUES ('wave-one')")) {
							firstEntered.resolve();
							await firstRelease.promise;
						} else if (event.query.includes("VALUES ('wave-two')")) {
							secondEntered.resolve();
							await secondRelease.promise;
						}
					},
					afterQuery: (event) => {
						if (event.query.includes("VALUES ('wave-one')")) {
							two = event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-two')");
							void two.catch(() => undefined);
						}
					},
				});
				const transaction = database.transaction(async (manager) => {
					registerSqliteCommitGuard(manager, guard);
					await manager.save(TransactionRecord, { name: 'root-candidate' });
				});
				const observed = allow
					? expect(transaction).resolves.toBeUndefined()
					: expect(transaction).rejects.toMatchObject({
							driverError: expect.any(SqliteCommitGuardRefusedError) as unknown,
						});
				try {
					await firstEntered.promise;
					expect(guard).not.toHaveBeenCalled();
					firstRelease.resolve();
					await secondEntered.promise;
					expect(guard).not.toHaveBeenCalled();
					secondRelease.resolve();
					await observed;
					expect(guard).toHaveBeenCalledTimes(1);
					expect(await names()).toEqual(allow ? ['root-candidate', 'wave-one', 'wave-two'] : []);
					expect(probe.events.indexOf('returned:wave-two')).toBeGreaterThan(-1);
					expect(probe.events.indexOf('returned:wave-two')).toBeLessThan(probe.events.indexOf('guard'));
					expect(probe.events.indexOf('returned:wave-two')).toBeLessThan(
						probe.events.indexOf(`submit:${allow ? 'COMMIT' : 'ROLLBACK'}`),
					);
					expect(probe.events.filter((event) => event === 'submit:COMMIT')).toHaveLength(allow ? 1 : 0);
					expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(
						allow
							? [
									{ id: 1, name: 'root-candidate' },
									{ id: 2, name: 'wave-one' },
									{ id: 3, name: 'wave-two' },
								]
							: [],
					);
				} finally {
					firstRelease.resolve();
					secondRelease.resolve();
					await Promise.allSettled([transaction, observed, one]);
					await Promise.allSettled([two]);
					probe.restore();
				}
			},
		);

		it.each([undefined, null, false, 0, '', new Error('original nested body')])(
			'refuses queued B/C with exact primary before full recovery: %p',
			async (primary) => {
				const entered = deferred(),
					release = deferred();
				const probe = timeline((sql) => {
					if (sql === 'ROLLBACK') {
						expect(bDone).toBe(true);
						expect(cDone).toBe(true);
					}
				});
				let a: Promise<unknown>, b: Promise<unknown>, c: Promise<unknown>;
				let bDone = false,
					cDone = false,
					bodies = 0,
					nestedStarts = 0;
				// eslint-disable-next-line @typescript-eslint/unbound-method
				const original = SqliteQueryRunner.prototype.query;
				let inject = true;
				jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
					if (inject && args[0].startsWith('ROLLBACK TO SAVEPOINT')) {
						inject = false;
						return Promise.reject(new Error('injected original savepoint rollback failure'));
					}
					return original.apply(this, args) as Promise<unknown>;
				});
				database.subscribers.push({
					beforeTransactionStart(event) {
						if ((Reflect.get(event.queryRunner, 'transactionDepth') as number) > 0) nestedStarts++;
					},
					afterTransactionRollback: async (event) => {
						if ((Reflect.get(event.queryRunner, 'transactionDepth') as number) === 0) {
							const denied = event.manager.transaction(() => {
								bodies++;
								return Promise.resolve();
							});
							const result = await Promise.allSettled([denied]);
							expect(result[0]).toEqual({ status: 'rejected', reason: primary });
							await expect(
								event.manager.query("INSERT INTO transaction_record(name) VALUES ('hook-escape')"),
							).rejects.toBe(primary);
						}
					},
				});
				const outer = database.transaction(async (manager) => {
					registerSqliteCommitGuard(manager, () => true);
					await manager.query("INSERT INTO transaction_record(name) VALUES ('root')");
					a = manager.transaction(async (nested) => {
						await nested.query("INSERT INTO transaction_record(name) VALUES ('A')");
						entered.resolve();
						await release.promise;
						throw primary as unknown as Error;
					});
					void a.catch(() => undefined);
					await entered.promise;
					b = manager.transaction(() => {
						bodies++;
						return Promise.resolve();
					});
					c = manager.transaction(() => {
						bodies++;
						return Promise.resolve();
					});
					void b.then(
						() => {
							bDone = true;
						},
						() => {
							bDone = true;
						},
					);
					void c.then(
						() => {
							cDone = true;
						},
						() => {
							cDone = true;
						},
					);
					release.resolve();
					await Promise.all([a, b, c]);
				});
				void outer.catch(() => undefined);
				try {
					const results = await Promise.allSettled([outer]);
					expect(results[0]).toEqual({ status: 'rejected', reason: primary });
					const children = await Promise.allSettled([a, b, c]);
					for (const result of children) {
						expect(result.status).toBe('rejected');
						if (result.status === 'rejected') expect(Object.is(result.reason, primary)).toBe(true);
					}
					expect(bodies).toBe(0);
					expect(nestedStarts).toBe(1);
					expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual([]);
					await database.manager.save(TransactionRecord, { name: 'healthy' });
					expect(await names()).toEqual(['healthy']);
				} finally {
					release.resolve();
					await Promise.allSettled([outer, a, b, c]);
					probe.restore();
				}
			},
		);

		it('keeps logical native-origin identity when queued siblings are refused by terminal full rollback', async () => {
			await database.manager.query("INSERT INTO transaction_record(id,name) VALUES (1,'original')");
			const before = await database.manager.find(TransactionRecord, { order: { id: 'ASC' } });
			const entered = deferred(),
				release = deferred();
			let a: Promise<unknown>, b: Promise<unknown>, c: Promise<unknown>, origin: unknown;
			let bodies = 0;
			let nativeOrigin: unknown;
			database.subscribers.push({
				afterQuery(event) {
					if (event.query.includes("VALUES (1,'duplicate')")) nativeOrigin = event.error as unknown;
				},
			});
			const outer = database.transaction(async (manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				window.applied();
				a = manager.transaction(async (nested) => {
					await nested.query("UPDATE transaction_record SET name='candidate' WHERE id=1");
					entered.resolve();
					await release.promise;
					try {
						await nested.query("INSERT OR ROLLBACK INTO transaction_record(id,name) VALUES (1,'duplicate')");
					} catch (cause) {
						origin = cause;
						throw cause;
					}
				});
				void a.catch(() => undefined);
				await entered.promise;
				b = manager.transaction(() => {
					bodies++;
					return Promise.resolve();
				});
				c = manager.transaction(() => {
					bodies++;
					return Promise.resolve();
				});
				void b.catch(() => undefined);
				void c.catch(() => undefined);
				release.resolve();
				await Promise.all([a, b, c]);
			});
			void outer.catch(() => undefined);
			try {
				await Promise.allSettled([outer]);
				const results = await Promise.allSettled([a, b, c, outer]);
				expect(origin).toBeInstanceOf(QueryFailedError);
				expect((origin as QueryFailedError).name).toBe('QueryFailedError');
				expect((origin as QueryFailedError).driverError).toBe(nativeOrigin);
				expect(nodeTypes.isNativeError(nativeOrigin)).toBe(true);
				expect(nativeOrigin).toMatchObject({ code: 'SQLITE_CONSTRAINT', errno: 19 });
				for (const result of results) {
					expect(result.status).toBe('rejected');
					if (result.status === 'rejected') expect(result.reason).toBe(origin);
				}
				console.info('queued-abort-origin', {
					logicalClass: origin instanceof QueryFailedError,
					nativeErrorBrand: nodeTypes.isNativeError(nativeOrigin),
					nativeErrorSameRealm: nativeOrigin instanceof Error,
					sameOriginForAll: results.every((result) => result.status === 'rejected' && result.reason === origin),
				});
				expect(bodies).toBe(0);
				expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual(before);
				await database.transaction(async (manager) => {
					await manager.query('SELECT 1');
				});
			} finally {
				release.resolve();
				await Promise.allSettled([outer, a, b, c]);
			}
		});
		it.each([false, true])('keeps healthy sibling savepoint order, guarded=%s', async (guarded) => {
			const order: string[] = [];
			await database.transaction(async (manager) => {
				if (guarded) registerSqliteCommitGuard(manager, () => true);
				await Promise.all(
					['A', 'B', 'C'].map((name) =>
						manager.transaction(async (nested) => {
							order.push(`${name}:start`);
							if (name === 'A') {
								await nested.queryRunner.startTransaction();
								await nested.query("INSERT INTO transaction_record(name) VALUES ('discarded-savepoint')");
								await nested.queryRunner.rollbackTransaction();
							}
							await nested.query('INSERT INTO transaction_record(name) VALUES (?)', [name]);
							order.push(`${name}:end`);
						}),
					),
				);
			});
			expect(order).toEqual(['A:start', 'A:end', 'B:start', 'B:end', 'C:start', 'C:end']);
			expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual([
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' },
				{ id: 3, name: 'C' },
			]);
		});

		it('joins an already-issued parentless child before uncaught-body rollback and leaves independent work independent', async () => {
			const probe = timeline();
			const entered = deferred(),
				release = deferred(),
				bodyThrows = deferred();
			let child: Promise<unknown>, independent: Promise<unknown>;
			const primary = new Error('body primary');
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query.includes("VALUES ('wave-two')")) {
						entered.resolve();
						await release.promise;
					}
				},
				afterQuery(event) {
					if (event.query.includes("VALUES ('wave-one')")) {
						child = event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-two')");
						void child.catch(() => undefined);
					}
				},
			});
			const outer = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => true);
				await manager.query("INSERT INTO transaction_record(name) VALUES ('wave-one')");
				await entered.promise;
				independent = outsideSqliteTransaction(database, () =>
					database.manager.query("INSERT INTO transaction_record(name) VALUES ('independent')"),
				);
				void independent.catch(() => undefined);
				bodyThrows.resolve();
				throw primary;
			});
			void outer.catch(() => undefined);
			try {
				await bodyThrows.promise;
				release.resolve();
				await expect(outer).rejects.toBe(primary);
				await independent;
				expect(probe.events.indexOf('returned:wave-two')).toBeLessThan(probe.events.indexOf('submit:ROLLBACK'));
				expect(probe.events.indexOf('returned:wave-two')).toBeGreaterThan(-1);
				expect(await names()).toEqual(['independent']);
			} finally {
				release.resolve();
				await Promise.allSettled([outer, child, independent]);
				probe.restore();
			}
		});

		it('drains the later original wave after retaining an earlier real native failure', async () => {
			const probe = timeline();
			const entered = deferred(),
				release = deferred();
			let later: Promise<unknown>, first: unknown;
			const guard = jest.fn(() => true);
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query.includes("VALUES ('wave-two')")) {
						entered.resolve();
						await release.promise;
					}
				},
				afterQuery(event) {
					if (event.query.includes("VALUES (1,'duplicate')")) {
						later = event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-two')");
						void later.catch(() => undefined);
					}
				},
			});
			const outer = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, guard);
				await manager.query("INSERT INTO transaction_record(id,name) VALUES (1,'original')");
				try {
					await manager.query("INSERT INTO transaction_record(id,name) VALUES (1,'duplicate')");
				} catch (cause) {
					first = cause;
				}
			});
			void outer.catch(() => undefined);
			try {
				await entered.promise;
				release.resolve();
				const outcome = (await Promise.allSettled([outer]))[0];
				expect(outcome.status).toBe('rejected');
				if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ driverError: { cause: first } });
				expect(guard).not.toHaveBeenCalled();
				expect(probe.events.indexOf('returned:wave-two')).toBeGreaterThan(-1);
				expect(probe.events.indexOf('returned:wave-two')).toBeLessThan(probe.events.indexOf('submit:ROLLBACK'));
				expect(await database.manager.find(TransactionRecord, { order: { id: 'ASC' } })).toEqual([]);
			} finally {
				release.resolve();
				await Promise.allSettled([outer, later]);
				probe.restore();
			}
		});
		it('keeps an admitted BeforeStart invocation real while terminal closure refuses its later SQL', async () => {
			const queryEntered = deferred(),
				queryRelease = deferred(),
				startEntered = deferred(),
				startRelease = deferred();
			let a: Promise<unknown>,
				b: Promise<unknown>,
				bSettled = false,
				body = 0,
				starts = 0;
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query.includes("VALUES (1,'duplicate')")) {
						queryEntered.resolve();
						await queryRelease.promise;
					}
				},
				beforeTransactionStart: async (event) => {
					if ((Reflect.get(event.queryRunner, 'transactionDepth') as number) > 0) {
						starts++;
						startEntered.resolve();
						await startRelease.promise;
					}
				},
			});
			const outer = database.transaction(async (manager) => {
				const window = captureSqliteNoMutationWindow(manager, () => true);
				window.applied();
				await manager.query("INSERT INTO transaction_record(id,name) VALUES (1,'original')");
				a = manager.query("INSERT INTO transaction_record(id,name) VALUES (1,'duplicate')");
				void a.catch(() => undefined);
				b = manager.transaction(() => {
					body++;
					return Promise.resolve();
				});
				void b.then(
					() => {
						bSettled = true;
					},
					() => {
						bSettled = true;
					},
				);
				await Promise.all([a, b]);
			});
			void outer.catch(() => undefined);
			try {
				await queryEntered.promise;
				await startEntered.promise;
				queryRelease.resolve();
				const first = (await Promise.allSettled([a]))[0];
				expect(first.status).toBe('rejected');
				expect(starts).toBe(1);
				expect(bSettled).toBe(false);
				startRelease.resolve();
				const results = await Promise.allSettled([outer, b]);
				if (first.status === 'rejected')
					for (const result of results) {
						expect(result.status).toBe('rejected');
						if (result.status === 'rejected') expect(result.reason).toBe(first.reason);
					}
				expect(body).toBe(0);
				expect(await names()).toEqual([]);
			} finally {
				queryRelease.resolve();
				startRelease.resolve();
				await Promise.allSettled([outer, a, b]);
			}
		});
		it('refuses an already-signaled first sibling before it resumes using one manual closure reason', async () => {
			const probe = timeline();
			let bodies = 0,
				starts = 0;
			let b: Promise<unknown>, rollback: Promise<void>, hook: Promise<unknown>;
			let reason: unknown;
			const primary = new Error('outer returns after explicit rollback');
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'ROLLBACK')
						await expect(
							event.manager.query("INSERT INTO transaction_record(name) VALUES ('rollback-hook-escape')"),
						).rejects.toBe(reason);
				},
				beforeTransactionStart(event) {
					if ((Reflect.get(event.queryRunner, 'transactionDepth') as number) > 0) starts++;
				},
				beforeTransactionRollback: async (event) => {
					if ((Reflect.get(event.queryRunner, 'transactionDepth') as number) === 1) {
						hook = event.manager.transaction(() => {
							bodies++;
							return Promise.resolve();
						});
						const result = (await Promise.allSettled([hook]))[0];
						expect(result.status).toBe('rejected');
						if (result.status === 'rejected') expect(result.reason).toBe(reason);
					}
				},
			});
			const outer = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => true);
				await manager.query("INSERT INTO transaction_record(name) VALUES ('root')");
				// The first sibling's predecessor is already complete; runNested crosses its original await.
				b = manager.transaction(() => {
					bodies++;
					return Promise.resolve();
				});
				void b.catch((cause: unknown) => {
					reason = cause;
				});
				// No await between issuing B and closing the actual original outer transaction.
				rollback = manager.queryRunner.rollbackTransaction();
				const result = await Promise.allSettled([b, rollback]);
				expect(result[0].status).toBe('rejected');
				expect(result[1].status).toBe('fulfilled');
				throw primary;
			});
			void outer.catch(() => undefined);
			try {
				await expect(outer).rejects.toBe(primary);
				expect(reason).toMatchObject({
					name: 'SqliteNestedTransactionAbortedError',
					message: 'Queued nested SQLite transaction was refused because its owning transaction is closing',
				});
				expect((reason as Error).cause).toBeUndefined();
				expect(bodies).toBe(0);
				expect(starts).toBe(0);
				expect(probe.events.filter((event) => event.startsWith('submit:SAVEPOINT'))).toHaveLength(0);
				expect(probe.events.filter((event) => event === 'submit:ROLLBACK')).toHaveLength(1);
				expect(await names()).toEqual([]);
			} finally {
				await Promise.allSettled([outer, b, rollback, hook]);
				probe.restore();
			}
		});
	});

	describe('guarded outer native COMMIT admission', () => {
		const nativeConnection = () => (database.driver as SqliteDriver).databaseConnection as NativeConnection;
		const guardRefusal: unknown = expect.any(SqliteCommitGuardRefusedError);
		const captureNativeAll = (native: NativeConnection): NativeConnection['all'] => {
			const method: unknown = Reflect.get(native, 'all');
			if (typeof method !== 'function') throw new Error('Expected the real native SQLite all method');
			return (query, parameters, callback) => Reflect.apply(method, native, [query, parameters, callback]) as unknown;
		};

		it.each([false, true])(
			'observes the real held outer native ACK without changing guarded=%s SQL or receiver',
			async (guarded) => {
				const native = nativeConnection(),
					invoke = captureNativeAll(native),
					entered = deferred(),
					resume = deferred();
				let receipt: SqliteCommitGuardReceipt | undefined,
					guardCalls = 0,
					completed = false;
				const calls: { query: string; parameters: unknown[] }[] = [];
				const spy = jest.spyOn(native, 'all').mockImplementation((query, parameters, callback) => {
					calls.push({ query, parameters });
					if (query !== 'COMMIT') return invoke(query, parameters, callback);
					return invoke(query, parameters, function (this: unknown, error: Error | null, rows?: unknown[]) {
						entered.resolve();
						const originalCallback: Readonly<{
							call: (receiver: unknown, error: Error | null, rows?: unknown[]) => void;
						}> = callback;
						void resume.promise.then(() => originalCallback.call(this, error, rows));
					});
				});
				const operation = database.transaction(async (manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					if (guarded)
						registerSqliteCommitGuard(manager, () => {
							guardCalls++;
							return manager.queryRunner?.isTransactionActive === true;
						});
					await manager.insert(TransactionRecord, { name: 'actual monitored record' });
				});
				void operation.then(
					() => {
						completed = true;
					},
					() => undefined,
				);
				try {
					await entered.promise;
					expect(receipt?.outcome).toBe('unknown');
					expect(completed).toBe(false);
					expect(calls.filter((call) => call.query === 'COMMIT')).toHaveLength(1);
					expect(spy.mock.contexts.every((receiver) => receiver === native)).toBe(true);
					resume.resolve();
					await operation;
					expect(receipt?.outcome).toBe('committed');
					expect(guardCalls).toBe(guarded ? 1 : 0);
					expect(await names()).toContain('actual monitored record');
				} finally {
					resume.resolve();
					await operation.catch(() => undefined);
					spy.mockRestore();
				}
			},
		);
		it('does not turn a native callback failure into committed evidence by reading persisted rows', async () => {
			const native = nativeConnection(),
				invoke = captureNativeAll(native),
				primary = new Error('native ACK unavailable');
			let receipt: SqliteCommitGuardReceipt | undefined;
			const spy = jest.spyOn(native, 'all').mockImplementation((query, parameters, callback) =>
				invoke(
					query,
					parameters,
					query !== 'COMMIT'
						? callback
						: function (this: unknown, error: Error | null, rows?: unknown[]) {
								callback.call(this, error ?? primary, rows);
							},
				),
			);
			try {
				await expect(
					database.transaction(async (manager) => {
						receipt = observeSqliteOuterOutcome(manager);
						await manager.insert(TransactionRecord, { name: 'committed without delivered ACK' });
					}),
				).rejects.toThrow();
				expect(receipt?.outcome).toBe('unknown');
				expect(await names()).toContain('committed without delivered ACK');
				expect(receipt?.outcome).toBe('unknown');
			} finally {
				spy.mockRestore();
			}
		});
		it.each([undefined, null, false, 0, '', 'native body P', new Error('native body P')])(
			'keeps actual rollback and exact primary %p with no committed observation',
			async (primary: unknown) => {
				let receipt: SqliteCommitGuardReceipt | undefined;
				await expect(
					database.transaction(async (manager) => {
						receipt = observeSqliteOuterOutcome(manager);
						await manager.insert(TransactionRecord, { name: 'must rollback' });
						throw primary;
					}),
				).rejects.toBe(primary);
				expect(receipt?.outcome).toBe('rolled_back');
				expect(await names()).not.toContain('must rollback');
			},
		);
		it('cannot borrow an outer receipt through a nested SAVEPOINT or an ordinary manager', async () => {
			expect(() => observeSqliteOuterOutcome(database.manager)).toThrow();
			let receipt: SqliteCommitGuardReceipt | undefined;
			await database.transaction(async (manager) => {
				receipt = observeSqliteOuterOutcome(manager);
				await manager.transaction(async (nested) => {
					expect(() => observeSqliteOuterOutcome(nested)).toThrow('outer');
					await nested.insert(TransactionRecord, { name: 'nested actual row' });
				});
				expect(receipt.outcome).toBe('pending');
			});
			expect(receipt?.outcome).toBe('committed');
			expect(await names()).toContain('nested actual row');
		});
		it.each([undefined, null, false, 0, '', 'late ACK P', new Error('late ACK P')])(
			'keeps real committed history and exact late subscriber primary %p',
			async (primary: unknown) => {
				let receipt: SqliteCommitGuardReceipt | undefined;
				const subscriber: EntitySubscriberInterface = {
					afterTransactionCommit: () => {
						throw primary;
					},
				};
				database.subscribers.push(subscriber);
				try {
					await expect(
						database.transaction(async (manager) => {
							receipt = observeSqliteOuterOutcome(manager);
							await manager.insert(TransactionRecord, { name: 'native ACK before subscriber P' });
						}),
					).rejects.toBe(primary);
					expect(receipt?.outcome).toBe('committed');
					expect(await names()).toContain('native ACK before subscriber P');
				} finally {
					const index = database.subscribers.indexOf(subscriber);
					if (index >= 0) database.subscribers.splice(index, 1);
				}
			},
		);
		it.each([undefined, null, false, 'release P', new Error('release P')])(
			'keeps historical actual ACK while its manual owner release rejects with %p',
			async (primary: unknown) => {
				const runner = database.createQueryRunner();
				const original: Readonly<{ release: QueryRunner['release'] }> = runner;
				const release = original.release;
				let receipt: SqliteCommitGuardReceipt | undefined;
				let releaseCompleted = false;
				const installed = jest.spyOn(runner, 'release').mockImplementation(async function (this: QueryRunner) {
					await release.call(this);
					releaseCompleted = true;
					throw primary;
				});
				const ownedDescriptor = Object.getOwnPropertyDescriptor(runner, 'release');
				let bodyFailure: { cause: unknown } | undefined;
				let cleanupFailure: { cause: unknown } | undefined;
				try {
					const lifecycle = (async () => {
						let failure: { cause: unknown } | undefined;
						try {
							await runner.manager.transaction(async (manager) => {
								receipt = observeSqliteOuterOutcome(manager);
								await manager.insert(TransactionRecord, { name: 'native ACK then release P' });
							});
						} catch (cause: unknown) {
							failure = { cause };
						} finally {
							try {
								await runner.release();
							} catch (cause: unknown) {
								failure ??= { cause };
							}
						}
						if (failure !== undefined) throw failure.cause;
					})();
					await expect(lifecycle).rejects.toBe(primary);
					expect(installed).toHaveBeenCalledTimes(1);
					expect(installed.mock.contexts[0]).toBe(runner);
					expect(releaseCompleted).toBe(true);
					expect(receipt?.outcome).toBe('committed');
					expect(await names()).toContain('native ACK then release P');
				} catch (cause: unknown) {
					bodyFailure = { cause };
				} finally {
					try {
						const current = Object.getOwnPropertyDescriptor(runner, 'release');
						if (
							!ownedDescriptor ||
							!current ||
							current.value !== ownedDescriptor.value ||
							current.get !== ownedDescriptor.get ||
							current.set !== ownedDescriptor.set ||
							current.writable !== ownedDescriptor.writable ||
							current.enumerable !== ownedDescriptor.enumerable ||
							current.configurable !== ownedDescriptor.configurable
						) {
							cleanupFailure = { cause: new Error('Manual owner release descriptor changed before cleanup') };
						} else {
							installed.mockRestore();
						}
					} catch (cause: unknown) {
						cleanupFailure = { cause };
					}
					if (!releaseCompleted) {
						try {
							await release.call(runner);
						} catch (cause: unknown) {
							cleanupFailure ??= { cause };
						}
					}
				}
				if (bodyFailure !== undefined) throw bodyFailure.cause;
				if (cleanupFailure !== undefined) throw cleanupFailure.cause;
			},
		);
		it('returns the automatic managed lease without invoking the callback runner public release spy', async () => {
			let receipt: SqliteCommitGuardReceipt | undefined;
			let restore: (() => void) | undefined;
			let releaseCalls = 0;
			let bodyFailure: { cause: unknown } | undefined;
			let cleanupFailure: { cause: unknown } | undefined;
			try {
				const result = await database.transaction(async (manager) => {
					const runner = manager.queryRunner;
					if (!runner) throw new Error('Missing genuine scoped runner');
					const original: Readonly<{ release: QueryRunner['release'] }> = runner;
					const release = original.release;
					const installed = jest.spyOn(runner, 'release').mockImplementation(async function (this: QueryRunner) {
						releaseCalls++;
						await release.call(this);
						throw new Error('Automatic route unexpectedly invoked public release');
					});
					const ownedDescriptor = Object.getOwnPropertyDescriptor(runner, 'release');
					restore = () => {
						const current = Object.getOwnPropertyDescriptor(runner, 'release');
						if (
							!ownedDescriptor ||
							!current ||
							current.value !== ownedDescriptor.value ||
							current.get !== ownedDescriptor.get ||
							current.set !== ownedDescriptor.set ||
							current.writable !== ownedDescriptor.writable ||
							current.enumerable !== ownedDescriptor.enumerable ||
							current.configurable !== ownedDescriptor.configurable
						) {
							throw new Error('Managed callback release descriptor changed before cleanup');
						}
						installed.mockRestore();
					};
					receipt = observeSqliteOuterOutcome(manager);
					await manager.insert(TransactionRecord, { name: 'managed lease without public release' });
				});
				expect(result).toBeUndefined();
				expect(releaseCalls).toBe(0);
				expect(receipt?.outcome).toBe('committed');
				expect(await names()).toContain('managed lease without public release');
			} catch (cause: unknown) {
				bodyFailure = { cause };
			} finally {
				try {
					restore?.();
				} catch (cause: unknown) {
					cleanupFailure = { cause };
				}
			}
			if (bodyFailure !== undefined) throw bodyFailure.cause;
			if (cleanupFailure !== undefined) throw cleanupFailure.cause;
		});

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
				first = registerSqliteCommitGuard(manager, () => {
					checks++;
					return true;
				});
				expect(() => registerSqliteCommitGuard(database.manager, () => true)).toThrow('scoped manager');
				await manager.transaction(async (nested) => {
					second = registerSqliteCommitGuard(nested, () => {
						checks++;
						return true;
					});
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
			const entered = deferred(),
				release = deferred();
			let current = true;
			let receipt: SqliteCommitGuardReceipt;
			const guard = jest.fn(() => current);
			database.subscribers.push({
				beforeTransactionCommit: async () => {
					entered.resolve();
					await release.promise;
				},
			});
			const native = nativeConnection();
			const all = jest.spyOn(native, 'all');
			const transaction = database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({
				driverError: guardRefusal,
			});
			await entered.promise;
			expect(guard).not.toHaveBeenCalled();
			current = false;
			release.resolve();
			await rejected;
			expect(all.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(receipt.outcome).toBe('refused');
			expect(await names()).toEqual([]);
		});

		it.each(['commit', 'refuse', 'child-failure'])(
			'drains work issued from a completed query context before outer guarded COMMIT (%s)',
			async (outcome) => {
				const resumeStale = deferred(),
					commitEntered = deferred(),
					commitRelease = deferred(),
					commitQueryEntered = deferred(),
					childEntered = deferred(),
					childRelease = deferred();
				const failure = new Error('expired-context child failed');
				const guard = jest.fn(() => outcome !== 'refuse');
				let receipt: SqliteCommitGuardReceipt | undefined;
				let lateChild: Promise<void> | undefined;
				let childFailure: { cause: unknown } | undefined;
				let seedCompleted = false;
				let transactionSettled = false;
				database.subscribers.push({
					beforeTransactionCommit: async () => {
						commitEntered.resolve();
						await commitRelease.promise;
					},
					beforeQuery: async (event) => {
						if (event.query === 'SELECT 23 AS stale_context_seed') {
							// Promise registration captures this query's actual ALS context. Resume only
							// after the query has returned and its operation contexts have expired.
							lateChild = resumeStale.promise
								.then(async () => {
									expect(seedCompleted).toBe(true);
									await event.manager.query("INSERT INTO transaction_record(name) VALUES ('late-child')");
								})
								.catch((cause: unknown) => {
									childFailure = { cause };
								});
						} else if (event.query.includes("VALUES ('late-child')")) {
							childEntered.resolve();
							await childRelease.promise;
							if (outcome === 'child-failure') throw failure;
						} else if (event.query === 'COMMIT') {
							commitQueryEntered.resolve();
						}
					},
				});
				const native = jest.spyOn(nativeConnection(), 'all');
				const transaction = database.transaction(async (manager) => {
					receipt = registerSqliteCommitGuard(manager, guard);
					await manager.insert(TransactionRecord, { name: 'root-candidate' });
					await manager.query('SELECT 23 AS stale_context_seed');
					seedCompleted = true;
				});
				const observedTransaction = transaction.then(
					() => {
						transactionSettled = true;
						return { status: 'fulfilled' as const };
					},
					(cause: unknown) => {
						transactionSettled = true;
						return { status: 'rejected' as const, cause };
					},
				);
				try {
					await commitEntered.promise;
					resumeStale.resolve();
					await childEntered.promise;
					commitRelease.resolve();
					await commitQueryEntered.promise;
					// Let the real TypeORM COMMIT path reach native admission while the INSERT is held.
					await new Promise<void>((resolve) => setImmediate(resolve));
					expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
					expect(guard).not.toHaveBeenCalled();
					expect(transactionSettled).toBe(false);
					childRelease.resolve();
					const result = await observedTransaction;
					await lateChild;
					if (outcome === 'commit') {
						expect(result.status).toBe('fulfilled');
						expect(receipt?.outcome).toBe('committed');
						expect(await names()).toEqual(['late-child', 'root-candidate']);
					} else {
						expect(result).toMatchObject({ status: 'rejected', cause: { driverError: guardRefusal } });
						expect(receipt?.outcome).toBe('refused');
						expect(await names()).toEqual([]);
					}
					expect(childFailure).toEqual(outcome === 'child-failure' ? { cause: failure } : undefined);
					if (outcome === 'child-failure') expect(childFailure?.cause).toBe(failure);
					expect(guard).toHaveBeenCalledTimes(outcome === 'child-failure' ? 0 : 1);
					expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(outcome === 'commit' ? 1 : 0);
				} finally {
					resumeStale.resolve();
					commitRelease.resolve();
					childRelease.resolve();
					await Promise.allSettled([observedTransaction, lateChild]);
				}
			},
		);

		it.each([false, true])(
			'closes final query-drain enrollment before retirement (child failure: %s)',
			async (failChild) => {
				const seedFinished = deferred(),
					childEntered = deferred(),
					childRelease = deferred();
				const failure = new Error('final-drain child failed');
				let lateChild: Promise<void> | undefined;
				let childFailure: { cause: unknown } | undefined;
				let receipt: SqliteCommitGuardReceipt | undefined;
				const guard = jest.fn(() => true);
				database.subscribers.push({
					beforeQuery: async (event) => {
						if (event.query === 'SELECT 24 AS retiring_context_seed') {
							// Capture the actual query ALS context. The real AfterQuery notification queues
							// this reaction before TypeORM adopts its native result promise. Two microtasks
							// target the final empty-drain/retirement interval without replacing any method.
							lateChild = new Promise<void>((resolve, reject) => {
								void seedFinished.promise.then(() => {
									queueMicrotask(() => {
										queueMicrotask(() => {
											void event.manager
												.query("INSERT INTO transaction_record(name) VALUES ('retirement-child')")
												.then(() => resolve(), reject);
										});
									});
								});
							}).catch((cause: unknown) => {
								childFailure = { cause };
							});
						} else if (event.query.includes("VALUES ('retirement-child')")) {
							childEntered.resolve();
							await childRelease.promise;
							if (failChild) throw failure;
						}
					},
					afterQuery: (event) => {
						if (event.query === 'SELECT 24 AS retiring_context_seed') seedFinished.resolve();
					},
				});
				const native = jest.spyOn(nativeConnection(), 'all');
				const transaction = database.transaction(async (manager) => {
					receipt = registerSqliteCommitGuard(manager, guard);
					await manager.insert(TransactionRecord, { name: 'retirement-root' });
					await manager.query('SELECT 24 AS retiring_context_seed');
				});
				const observedTransaction = transaction.then(
					() => ({ status: 'fulfilled' as const }),
					(cause: unknown) => ({ status: 'rejected' as const, cause }),
				);
				try {
					await childEntered.promise;
					await new Promise<void>((resolve) => setImmediate(resolve));
					expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
					expect(guard).not.toHaveBeenCalled();
					childRelease.resolve();
					const result = await observedTransaction;
					await lateChild;
					if (failChild) {
						expect(result).toEqual({ status: 'rejected', cause: failure });
						expect(childFailure?.cause).toBe(failure);
						expect(receipt?.outcome).toBe('rolled_back');
						expect(await names()).toEqual([]);
					} else {
						expect(result.status).toBe('fulfilled');
						expect(childFailure).toBeUndefined();
						expect(receipt?.outcome).toBe('committed');
						expect(await names()).toEqual(['retirement-child', 'retirement-root']);
					}
					expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(failChild ? 0 : 1);
				} finally {
					seedFinished.resolve();
					childRelease.resolve();
					await Promise.allSettled([observedTransaction, lateChild]);
				}
			},
		);

		it('drains BeforeQuery children in successive same-lease waves before sealing and evaluating guards', async () => {
			const firstEntered = deferred(),
				firstRelease = deferred();
			const secondEntered = deferred(),
				secondRelease = deferred();
			const guard = jest.fn(() => false);
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') {
						void event.manager.query("INSERT INTO transaction_record(name) VALUES ('wave-one')");
					} else if (event.query.includes("VALUES ('wave-one')")) {
						firstEntered.resolve();
						await firstRelease.promise;
					} else if (event.query.includes("VALUES ('wave-two')")) {
						secondEntered.resolve();
						await secondRelease.promise;
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
			const rejected = expect(transaction).rejects.toMatchObject({
				driverError: guardRefusal,
			});
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
			const entered = deferred(),
				release = deferred();
			const guard = jest.fn(() => true);
			let observed: unknown;
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') {
						void event.manager
							.query("INSERT INTO transaction_record(name) VALUES ('failed-child')")
							.catch((cause: unknown) => {
								observed = cause;
							});
					} else if (event.query.includes("VALUES ('failed-child')")) {
						entered.resolve();
						await release.promise;
						throw new Error('child subscriber failure');
					}
				},
			});
			const native = jest.spyOn(nativeConnection(), 'all');
			const transaction = database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({
				driverError: guardRefusal,
			});
			await entered.promise;
			await new Promise<void>((resolve) => setImmediate(resolve));
			release.resolve();
			await rejected;
			expect(observed).toEqual(new Error('child subscriber failure'));
			expect(guard).not.toHaveBeenCalled();
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(await names()).toEqual([]);
		});

		it.each([false, true])(
			'retains a settled child rejection before COMMIT subscriber release (late guard: %s)',
			async (lateGuard) => {
				const settled = deferred(),
					subscriberRelease = deferred();
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
				const rejected = expect(transaction).rejects.toMatchObject({
					driverError: guardRefusal,
				});
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
			},
		);

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

		it('retains an AfterTransactionStart child rejection handled before the body attaches its first guard', async () => {
			const failure = new Error('handled start child failure');
			const startHandled = deferred(),
				startRelease = deferred();
			let observed: unknown;
			let receipt: SqliteCommitGuardReceipt;
			const guard = jest.fn(() => true);
			database.subscribers.push({
				afterTransactionStart: async (event) => {
					// The child is settled/handled BEFORE this subscriber returns or the body can attach a guard.
					const child = event.manager.query("INSERT INTO transaction_record(name) VALUES ('start-child')");
					await child.catch((cause: unknown) => {
						observed = cause;
					});
					startHandled.resolve();
					await startRelease.promise;
				},
				beforeQuery: (event) => {
					if (event.query.includes("VALUES ('start-child')")) throw failure;
				},
			});
			const native = jest.spyOn(nativeConnection(), 'all');
			const transaction = database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, guard);
				await manager.save(TransactionRecord, { name: 'start-window-candidate' });
			});
			const rejected = expect(transaction).rejects.toMatchObject({
				driverError: guardRefusal,
			});
			await startHandled.promise;
			expect(observed).toBe(failure);
			expect(receipt).toBeUndefined();
			const queuedRead = names();
			startRelease.resolve();
			await rejected;
			expect(receipt.outcome).toBe('refused');
			expect(guard).not.toHaveBeenCalled();
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(await queuedRead).toEqual([]);
			database.subscribers.length = 0;
			let next: SqliteCommitGuardReceipt;
			await database.transaction(async (manager) => {
				next = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'next-start-owner' });
			});
			expect(next.outcome).toBe('committed');
			expect(await names()).toEqual(['next-start-owner']);
		});

		it.each(['before', 'after'])('closes a failed outer %s-start scope before the next guarded lease', async (hook) => {
			const failure = new Error('original start subscriber error');
			const body = jest.fn();
			database.subscribers.push({
				beforeTransactionStart: (event) => {
					// STARTING records evidence without opening early guard-registration authority.
					expect(() => registerSqliteCommitGuard(event.manager, () => true)).toThrow('open transaction');
					if (hook === 'before') throw failure;
				},
				afterTransactionStart: async (event) => {
					await event.manager.query('SELECT * FROM nonexistent_start_fixture').catch(() => undefined);
					throw failure;
				},
			});
			await expect(
				database.transaction(() => {
					body();
					return Promise.resolve();
				}),
			).rejects.toBe(failure);
			expect(body).not.toHaveBeenCalled();
			expect(isSqliteTransactionActive(database)).toBe(false);
			database.subscribers.length = 0;
			let receipt: SqliteCommitGuardReceipt;
			await database.transaction(async (manager) => {
				receipt = registerSqliteCommitGuard(manager, () => true);
				await manager.save(TransactionRecord, { name: 'healthy-after-failed-start' });
			});
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['healthy-after-failed-start']);
		});

		it('accepts a first guard attached by BeforeQuery and refuses without native submission', async () => {
			let receipt: SqliteCommitGuardReceipt;
			database.subscribers.push({
				beforeQuery: (event) => {
					if (event.query === 'COMMIT') receipt = registerSqliteCommitGuard(event.manager, () => false);
				},
			});
			const native = jest.spyOn(nativeConnection(), 'all');
			await expect(
				database.transaction((manager) => manager.save(TransactionRecord, { name: 'late-guard' })),
			).rejects.toMatchObject({ driverError: guardRefusal });
			expect(native.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(0);
			expect(receipt.outcome).toBe('refused');
			expect(await names()).toEqual([]);
		});

		it('seals new candidate work and guard attachment but permits valid post-commit subscriber work', async () => {
			let lateQuery: Promise<unknown>;
			let receipt: SqliteCommitGuardReceipt;
			let afterQueryReads = 0;
			let originalRead: Promise<void>;
			database.subscribers.push({
				afterQuery: (event) => {
					if (event.query === 'COMMIT') {
						originalRead = event.manager.query('SELECT 1').then(() => {
							afterQueryReads++;
						});
						return originalRead;
					}
				},
				afterTransactionCommit: (event) =>
					event.manager.query("INSERT INTO transaction_record(name) VALUES ('post-commit')"),
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
			await originalRead;
			expect(afterQueryReads).toBe(1);
			expect(receipt.outcome).toBe('committed');
			expect(await names()).toEqual(['candidate', 'post-commit']);
		});

		it.each([false, true])(
			'settles false/throw guard refusal through TypeORM and allows rollback recovery (throw: %s)',
			async (throws) => {
				let receipt: SqliteCommitGuardReceipt;
				let rollbackNotifications = 0;
				database.subscribers.push({
					beforeTransactionRollback: () => {
						throw new Error('injected rollback subscriber failure');
					},
					afterTransactionRollback: () => {
						rollbackNotifications++;
					},
				});
				await expect(
					database.transaction(async (manager) => {
						receipt = registerSqliteCommitGuard(manager, () => {
							if (throws) throw new Error('original guard failure');
							return false;
						});
						await manager.save(TransactionRecord, { name: 'must-rollback' });
					}),
				).rejects.toMatchObject({ driverError: guardRefusal });
				expect(receipt.outcome).toBe('refused');
				expect(rollbackNotifications).toBe(1);
				expect(isSqliteTransactionActive(database)).toBe(false);
				expect(await names()).toEqual([]);
				database.subscribers.length = 0;
				await database.transaction((manager) => manager.save(TransactionRecord, { name: 'next-owner' }));
				expect(await names()).toEqual(['next-owner']);
			},
		);

		it.each([false, true])(
			'rechecks the original guard on every actual TypeORM busy redispatch (revoke: %s)',
			async (revoke) => {
				Object.assign(database.options, { busyErrorRetry: 1 });
				const native = nativeConnection(),
					invoke = captureNativeAll(native);
				let attempts = 0,
					current = true;
				let receipt: SqliteCommitGuardReceipt;
				const guard = jest.fn(() => current);
				jest.spyOn(native, 'all').mockImplementation(function (this: NativeConnection, query, parameters, callback) {
					if (query === 'COMMIT' && ++attempts === 1) {
						current = !revoke;
						queueMicrotask(() => {
							callback.call(this, new Error('SQLITE_BUSY: injected busy commit'));
						});
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
					await expect(transaction).rejects.toMatchObject({ driverError: guardRefusal });
				} else {
					await transaction;
				}
				expect(guard).toHaveBeenCalledTimes(2);
				expect(attempts).toBe(revoke ? 1 : 2);
				expect(receipt.outcome).toBe(revoke ? 'refused' : 'committed');
				expect(log.mock.calls.filter(([query]) => query === 'COMMIT')).toHaveLength(1);
				expect(await names()).toEqual(revoke ? [] : ['busy-candidate']);
			},
		);

		it('preserves native callback receiver, rows, logger and query/transaction broadcasts without patching the shared handle', async () => {
			const native = nativeConnection(),
				invoke = captureNativeAll(native);
			let receiverReads = 0;
			const events: string[] = [];
			const all = jest.spyOn(native, 'all').mockImplementation(function (
				this: NativeConnection,
				query,
				parameters,
				callback,
			) {
				if (query !== 'COMMIT') return invoke(query, parameters, callback);
				return invoke(query, parameters, function (this: unknown, error, rows) {
					callback.call(
						{
							get changes() {
								receiverReads++;
								return 0;
							},
						},
						error,
						rows,
					);
				});
			});
			const log = jest.spyOn(database.logger, 'logQuery');
			database.subscribers.push({
				beforeTransactionCommit: () => {
					events.push('before-transaction');
				},
				beforeQuery: (event) => {
					if (event.query === 'COMMIT') events.push('before-query');
				},
				afterQuery: (event) => {
					if (event.query === 'COMMIT') {
						expect(event.success).toBe(true);
						expect(event.rawResults).toEqual([]);
						events.push('after-query');
					}
				},
				afterTransactionCommit: () => {
					events.push('after-transaction');
				},
			});
			await database.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => {
					events.push('guard');
					return true;
				});
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
			const native = nativeConnection(),
				invoke = captureNativeAll(native);
			let receipt: SqliteCommitGuardReceipt;
			jest.spyOn(native, 'all').mockImplementation(function (this: NativeConnection, query, parameters, callback) {
				if (query !== 'COMMIT') return invoke(query, parameters, callback);
				expect(receipt.outcome).toBe('unknown');
				return invoke(query, parameters, function (this: unknown, error, rows) {
					callback.call(this, error ?? new Error('injected missing commit acknowledgement'), rows);
				});
			});
			await expect(
				database.transaction(async (manager) => {
					receipt = registerSqliteCommitGuard(manager, () => true);
					await manager.save(TransactionRecord, { name: 'durable-but-unconfirmed' });
				}),
			).rejects.toThrow('missing commit acknowledgement');
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
					const rejected = release.promise.then(() => {
						throw failure;
					});
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
				afterTransactionCommit: () => {
					throw new Error('post-commit subscriber failure');
				},
			});
			await expect(
				database.transaction(async (manager) => {
					receipt = registerSqliteCommitGuard(manager, () => true);
					await manager.save(TransactionRecord, { name: 'committed-before-subscriber' });
				}),
			).rejects.toThrow('post-commit subscriber failure');
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
		let receipt: SqliteCommitGuardReceipt | undefined;
		await expect(
			database.transaction(async (manager) => {
				receipt = observeSqliteOuterOutcome(manager);
				await manager.save(TransactionRecord, { name: 'uncertain' });
				throw new Error('operation failure');
			}),
		).rejects.toThrow('operation failure');
		expect(receipt?.outcome).toBe('unknown');
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

	it('returns a rejected repository Promise for an orphaned context while its manual transaction remains active', async () => {
		const runner = database.createQueryRunner();
		const resume = deferred();
		let continuation: Promise<void> | undefined;
		let returnedNormally = false;
		let synchronousFailure: { cause: unknown } | undefined;
		let rejection: unknown;
		const queries: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				queries.push(event.query);
				if (event.query !== 'SELECT 25 AS orphaned_manual_context') return;
				continuation = resume.promise.then(async () => {
					let write: Promise<TransactionRecord>;
					try {
						write = event.manager.getRepository(TransactionRecord).save({ name: 'forbidden-orphan-write' });
						returnedNormally = true;
					} catch (cause: unknown) {
						synchronousFailure = { cause };
						return;
					}
					await write.catch((cause: unknown) => {
						rejection = cause;
					});
				});
			},
		});
		try {
			await runner.startTransaction();
			await runner.manager.insert(TransactionRecord, { name: 'owner-before' });
			await runner.manager.query('SELECT 25 AS orphaned_manual_context');
			// All query contexts have retired, but the manual owner's transaction and lease remain live.
			const beforeRejectedWrite = queries.length;
			resume.resolve();
			await continuation;
			expect(synchronousFailure).toBeUndefined();
			expect(returnedNormally).toBe(true);
			expect(rejection).toEqual(new Error('SQLite operation requires an active owning context on its original lease'));
			expect(queries).toHaveLength(beforeRejectedWrite);
			expect(runner.isTransactionActive).toBe(true);
			await runner.manager.insert(TransactionRecord, { name: 'owner-after' });
			await runner.commitTransaction();
			expect(await names()).toEqual(['owner-after', 'owner-before']);
		} finally {
			resume.resolve();
			await continuation;
			await runner.release();
		}
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

describe('read-only caller SQLite connection lease presence', () => {
	it('does not allocate a runner/coordinator or issue a query on unknown or destroyed data sources', async () => {
		const unknown = new DataSource({ type: 'sqlite', database: ':memory:' });
		const create = jest.spyOn(unknown, 'createQueryRunner');
		const query = jest.spyOn(unknown, 'query');
		expect(hasCurrentSqliteConnectionLease(unknown)).toBe(false);
		expect(create).not.toHaveBeenCalled();
		expect(query).not.toHaveBeenCalled();
		const database = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		await database.destroy();
		const afterDestroy = jest.spyOn(database, 'createQueryRunner');
		expect(hasCurrentSqliteConnectionLease(database)).toBe(false);
		expect(afterDestroy).not.toHaveBeenCalled();
	});

	it('reports this ordinary SELECT caller lease despite TXfalse, but not another caller or a detached callback', async () => {
		const database = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const entered = deferred(),
			release = deferred();
		database.subscribers.push({
			beforeQuery: async (event) => {
				if (event.query !== 'SELECT 11 AS caller_lease_probe') return;
				expect(event.queryRunner.isTransactionActive).toBe(false);
				expect(hasCurrentSqliteConnectionLease(database)).toBe(true);
				expect(outsideSqliteTransaction(database, () => hasCurrentSqliteConnectionLease(database))).toBe(false);
				entered.resolve();
				await release.promise;
			},
		});
		const query = database.query('SELECT 11 AS caller_lease_probe');
		try {
			await entered.promise;
			expect(hasCurrentSqliteConnectionLease(database)).toBe(false);
		} finally {
			release.resolve();
			await query;
			await database.destroy();
		}
		expect(hasCurrentSqliteConnectionLease(database)).toBe(false);
	});

	it('conservatively retains an inactive child context while its parent lease is active, then closes it', async () => {
		const database = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const childResume = deferred(),
			parentResume = deferred();
		let child: Promise<boolean> | undefined, releasedChild: Promise<boolean> | undefined;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query !== 'SELECT 12 AS inactive_child_probe') return;
				child = childResume.promise.then(() => hasCurrentSqliteConnectionLease(database));
				releasedChild = parentResume.promise.then(() => hasCurrentSqliteConnectionLease(database));
			},
		});
		try {
			await database.transaction(async (manager) => {
				await manager.query('SELECT 12 AS inactive_child_probe');
				childResume.resolve();
				if (child === undefined) throw new Error('Missing child context probe');
				expect(await child).toBe(true); // conservative presence, not a writer scope certificate
			});
			parentResume.resolve();
			if (releasedChild === undefined) throw new Error('Missing released child context probe');
			expect(await releasedChild).toBe(false);
		} finally {
			childResume.resolve();
			parentResume.resolve();
			await database.destroy();
		}
	});
});
