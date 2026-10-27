import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EntityManager, QueryFailedError, QueryRunner, TransactionStartEvent } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import {
	SqliteCommitGuardRefusedError,
	SqliteDataSource,
	createSqliteDataSource,
	outsideSqliteTransaction,
	registerSqliteCommitGuard,
} from './sqlite-data-source';

function deferred() {
	let resolve: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve: () => resolve() };
}

type Callback = (this: unknown, error: Error | null, rows?: unknown[]) => void;
interface NativeConnection {
	run(query: string, ...args: unknown[]): unknown;
	all(query: string, parameters: unknown[], callback: Callback): unknown;
}
const nativeOf = (source: SqliteDataSource) => (source.driver as SqliteDriver).databaseConnection as NativeConnection;
const depthOf = (runner: QueryRunner) => (runner as QueryRunner & { transactionDepth: number }).transactionDepth;

function expectOriginalCommitRefusal(error: unknown, cause: unknown): void {
	expect(error).toBeInstanceOf(QueryFailedError);
	if (!(error instanceof QueryFailedError))
		throw new Error('Expected original TypeORM COMMIT error envelope', { cause: error });
	expect(error.query).toBe('COMMIT');
	const driverError: unknown = error.driverError;
	expect(driverError).toBeInstanceOf(SqliteCommitGuardRefusedError);
	if (!(driverError instanceof SqliteCommitGuardRefusedError)) throw new Error('Expected original guard refusal');
	expect(driverError.cause).toBe(cause);
	expect(Object.hasOwn(driverError, 'cause')).toBe(true);
}

describe('fresh SQLite write admission (real native handles)', () => {
	let source: SqliteDataSource;

	beforeEach(async () => {
		source = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		await source.query('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT)');
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (source.isInitialized) await source.destroy();
	});

	it('retains logical event order, exact runner, started SQL/children and ordinary savepoints', async () => {
		const order: string[] = [];
		let runner: QueryRunner;
		const native = nativeOf(source);
		const all = native.all.bind(native) as NativeConnection['all'];
		jest.spyOn(native, 'all').mockImplementation(function (query, parameters, callback) {
			order.push(`submit:${query}`);
			return all.call(native, query, parameters, function (error, rows) {
				order.push(`ack:${query}`);
				callback.call(this, error, rows);
			});
		});
		source.subscribers.push({
			beforeTransactionStart(event: TransactionStartEvent) {
				order.push(`before:${depthOf(event.queryRunner)}`);
				expect(event.queryRunner.isTransactionActive).toBe(true);
			},
			async afterTransactionStart(event: TransactionStartEvent) {
				order.push(`after:${depthOf(event.queryRunner)}`);
				if (depthOf(event.queryRunner) === 1) {
					runner = event.queryRunner;
					await event.manager.query('SELECT 7');
					void event.manager.query('SELECT 8');
				}
			},
		});
		const result = await source.transactionWithWriteIntent(async (manager) => {
			expect(manager.queryRunner).toBe(runner);
			expect(Object.getPrototypeOf(await manager.queryRunner.connect())).toBe(Object.getPrototypeOf(native));
			order.push('body');
			await manager.transaction(async (nested) => {
				expect(nested).toBe(manager);
				await nested.query("INSERT INTO records VALUES (1, 'nested')");
			});
			return 19;
		});
		expect(result).toBe(19);
		expect(order.slice(0, 5)).toEqual([
			'before:0',
			'submit:BEGIN IMMEDIATE TRANSACTION',
			'ack:BEGIN IMMEDIATE TRANSACTION',
			'after:1',
			'submit:SELECT 7',
		]);
		expect(order.indexOf('ack:SELECT 8')).toBeLessThan(order.indexOf('body'));
		expect(order).toContain('submit:SAVEPOINT typeorm_1');
		expect(order).toContain('ack:RELEASE SAVEPOINT typeorm_1');
		expect(order.at(-1)).toBe('ack:COMMIT');
		expect(await source.query('SELECT * FROM records')).toEqual([{ id: 1, value: 'nested' }]);
	});

	it.each(['before', 'query'] as const)(
		'consumes its permit before %s observers can submit identical BEGIN SQL',
		async (phase) => {
			const refused: unknown[] = [];
			const native = nativeOf(source);
			const all = jest.spyOn(native, 'all');
			const attempt = async (manager: EntityManager) => {
				try {
					await manager.query('BEGIN IMMEDIATE TRANSACTION');
				} catch (error) {
					refused.push(error);
				}
			};
			source.subscribers.push({
				beforeTransactionStart: phase === 'before' ? (event) => attempt(event.manager) : undefined,
				beforeQuery: phase === 'query' ? (event) => attempt(event.manager) : undefined,
			});
			// Avoid observing post-admission queries/COMMIT with this deliberately recursive observer.
			const observer = source.subscribers.at(-1);
			const receipt: { outcome: string }[] = [];
			const rejected: unknown = await source
				.transactionWithWriteIntent((manager) => {
					source.subscribers.splice(source.subscribers.indexOf(observer), 1);
					receipt.push(registerSqliteCommitGuard(manager, () => true));
					return Promise.resolve();
				})
				.then(
					() => undefined,
					(error: unknown) => error,
				);
			expectOriginalCommitRefusal(rejected, refused[0]);
			expect(refused).toHaveLength(1);
			expect((refused[0] as Error).message).toContain('before BEGIN');
			expect(all.mock.calls.map(([query]) => query)).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'ROLLBACK']);
			expect(receipt[0].outcome).toBe('refused');
			await source.transaction(() => Promise.resolve());
			expect(all.mock.calls.at(-2)?.[0]).toBe('BEGIN TRANSACTION');
		},
	);

	it.each(['before', 'query'] as const)('rejects awaited %s SQL without invoking the body', async (phase) => {
		const all = jest.spyOn(nativeOf(source), 'all');
		const body = jest.fn();
		source.subscribers.push({
			beforeTransactionStart: phase === 'before' ? (event) => event.manager.query('SELECT 42') : undefined,
			beforeQuery: phase === 'query' ? (event) => event.manager.query('SELECT 42') : undefined,
		});
		await expect(source.transactionWithWriteIntent(body)).rejects.toThrow('before BEGIN acknowledgement');
		expect(body).not.toHaveBeenCalled();
		expect(all).not.toHaveBeenCalled();
		source.subscribers.length = 0;
		await source.transaction(() => Promise.resolve());
	});

	it.each([
		['before', 'manager', true],
		['before', 'manager', false],
		['before', 'direct', true],
		['before', 'direct', false],
		['query', 'manager', true],
		['query', 'manager', false],
		['query', 'direct', true],
		['query', 'direct', false],
	] as const)('keeps the pending parent for %s %s reentry caught=%s', async (phase, kind, caught) => {
		const native = nativeOf(source);
		const all = jest.spyOn(native, 'all'),
			run = jest.spyOn(native, 'run');
		let receipt: { outcome: string } | undefined;
		const body = jest.fn(async (manager: EntityManager) => {
			receipt = registerSqliteCommitGuard(manager, () => true);
			await manager.query("INSERT INTO records VALUES (1, 'candidate')");
		});
		let refusal: unknown;
		let parentScope: unknown;
		const reenter = async (event: TransactionStartEvent) => {
			const runner = event.queryRunner;
			parentScope = Reflect.get(runner, 'guardedCommit') as unknown;
			try {
				if (kind === 'manager') await event.manager.transaction(() => Promise.reject(new Error('nested callback ran')));
				else await runner.startTransaction();
			} catch (error) {
				refusal = error;
				expect(Reflect.get(runner, 'guardedCommit')).toBe(parentScope);
				expect(runner.isTransactionActive).toBe(true);
				expect(depthOf(runner)).toBe(0);
				if (!caught) throw error;
			}
		};
		source.subscribers.push({
			beforeTransactionStart: phase === 'before' ? reenter : undefined,
			beforeQuery: phase === 'query' ? (event) => reenter(event) : undefined,
		});
		const observer = source.subscribers.at(-1);
		// Remove the observer at AfterStart so later candidate SQL cannot recursively exercise it.
		source.subscribers.push({
			afterTransactionStart() {
				source.subscribers.splice(source.subscribers.indexOf(observer), 1);
			},
		});
		const result = source.transactionWithWriteIntent(body);
		const observed: unknown = await result.then(
			() => undefined,
			(error: unknown) => error,
		);
		if (caught) expectOriginalCommitRefusal(observed, refusal);
		else expect(observed).toBe(refusal);
		expect((refusal as Error).message).toContain('reentrant transaction start');
		expect(body).toHaveBeenCalledTimes(caught ? 1 : 0);
		expect(receipt?.outcome).toBe(caught ? 'refused' : undefined);
		// Only genuine outer failed-start recovery may use the last-resort raw ROLLBACK.
		expect(run.mock.calls.filter(([query]) => query === 'ROLLBACK')).toHaveLength(caught ? 0 : 1);
		expect(all.mock.calls.map(([query]) => query)).toEqual(caught ? ['BEGIN IMMEDIATE TRANSACTION', 'ROLLBACK'] : []);
		source.subscribers.length = 0;
		expect(await source.query('SELECT * FROM records')).toEqual([]);
		await source.transaction(() => Promise.resolve());
	});

	it.each([undefined, null, false, 0, ''])('preserves falsy BeforeStart failure %p and clears mode', async (cause) => {
		source.subscribers.push({
			// Intentionally inject falsy rejection values to verify error presence/identity through TypeORM.
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			beforeTransactionStart: () => new Promise<void>((_resolve, reject) => reject(cause)),
		});
		const body = jest.fn();
		await expect(source.transactionWithWriteIntent(body)).rejects.toBe(cause);
		expect(body).not.toHaveBeenCalled();
		source.subscribers.length = 0;
		const all = jest.spyOn(nativeOf(source), 'all');
		await source.transaction(() => Promise.resolve());
		expect(all.mock.calls.map(([query]) => query)).toEqual(['BEGIN TRANSACTION', 'COMMIT']);
	});

	it('retains AfterStart rollback notifications and exact cause', async () => {
		const cause = new Error('after start failed');
		const rolledBack = jest.fn();
		source.subscribers.push({
			afterTransactionStart: () => Promise.reject(cause),
			afterTransactionRollback: rolledBack,
		});
		await expect(source.transactionWithWriteIntent(() => Promise.reject(new Error('body ran')))).rejects.toBe(cause);
		expect(rolledBack).toHaveBeenCalledTimes(1);
		source.subscribers.length = 0;
		await source.transaction(() => Promise.resolve());
	});

	it('does not suppress a genuine parent rollback after a caught direct reentrant start', async () => {
		const cause = new Error('body failed');
		const all = jest.spyOn(nativeOf(source), 'all');
		source.subscribers.push({
			async beforeTransactionStart(event) {
				await expect(event.queryRunner.startTransaction()).rejects.toThrow('reentrant transaction start');
			},
		});
		await expect(source.transactionWithWriteIntent(() => Promise.reject(cause))).rejects.toBe(cause);
		expect(all.mock.calls.map(([query]) => query)).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'ROLLBACK']);
	});

	it('rejects borrowed new entry before mode/body and keeps the original outer transaction', async () => {
		const body = jest.fn();
		const all = jest.spyOn(nativeOf(source), 'all');
		await source.transaction(async (manager) => {
			await expect(source.transactionWithWriteIntent(body)).rejects.toThrow('fresh connection lease');
			await manager.query("INSERT INTO records VALUES (1, 'original')");
		});
		expect(body).not.toHaveBeenCalled();
		expect(all.mock.calls.map(([query]) => query)).toEqual(['BEGIN TRANSACTION', 'COMMIT']);
	});

	it('queues another request behind its physical owner and does not adopt its runner', async () => {
		const entered = deferred(),
			release = deferred();
		let original: QueryRunner;
		const first = source.transaction(async (manager) => {
			original = manager.queryRunner;
			entered.resolve();
			await release.promise;
		});
		await entered.promise;
		let body = false;
		const second = outsideSqliteTransaction(source, () =>
			source.transactionWithWriteIntent((manager) => {
				body = true;
				expect(manager.queryRunner).not.toBe(original);
				return Promise.resolve();
			}),
		);
		try {
			expect(body).toBe(false);
		} finally {
			release.resolve();
			await Promise.all([first, second]);
		}
		expect(body).toBe(true);
	});

	it('leaves default BeforeStart SQL and explicit isolation unchanged', async () => {
		const all = jest.spyOn(nativeOf(source), 'all');
		source.subscribers.push({ beforeTransactionStart: (event) => event.manager.query('SELECT 3') });
		await source.transaction('READ UNCOMMITTED', () => Promise.resolve());
		expect(all.mock.calls.map(([query]) => query)).toEqual([
			'SELECT 3',
			'PRAGMA read_uncommitted = true',
			'BEGIN TRANSACTION',
			'COMMIT',
		]);
	});

	it('requires initialized/available source without creating a runner', async () => {
		const cold = new SqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const create = jest.spyOn(cold, 'createQueryRunner');
		await expect(cold.transactionWithWriteIntent(() => Promise.resolve())).rejects.toThrow('initialized');
		expect(create).not.toHaveBeenCalled();
		await source.destroy();
		await expect(source.transactionWithWriteIntent(() => Promise.resolve())).rejects.toThrow('destroyed');
	});

	it.each([true, false])(
		'native independent writer releases=%s before admission or admission fails body0',
		async (progress) => {
			const directory = await mkdtemp(join(tmpdir(), 'sqlite-write-intent-'));
			let a: SqliteDataSource, b: SqliteDataSource;
			const release = deferred(),
				entered = deferred();
			let first: Promise<void> | undefined;
			const facts: string[] = [];
			try {
				a = await createSqliteDataSource({ type: 'sqlite', database: join(directory, 'shared.sqlite') });
				b = await createSqliteDataSource({ type: 'sqlite', database: join(directory, 'shared.sqlite') });
				expect(nativeOf(a)).not.toBe(nativeOf(b));
				await a.query('CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT)');
				for (const [label, database] of [
					['A', a],
					['B', b],
				] as const) {
					const native = nativeOf(database),
						all = native.all.bind(native) as NativeConnection['all'];
					jest.spyOn(native, 'all').mockImplementation(function (query, parameters, callback) {
						facts.push(`${label}:submit:${query}`);
						const result: unknown = all.call(native, query, parameters, function (error, rows) {
							facts.push(`${label}:${error ? 'error' : 'ack'}:${query}`);
							callback.call(this, error, rows);
						});
						if (label === 'B' && query === 'BEGIN IMMEDIATE TRANSACTION' && progress) release.resolve();
						return result;
					});
				}
				first = a.transaction(async (manager) => {
					await manager.query("INSERT INTO records VALUES (1, 'A')");
					facts.push('A:DML-ack');
					entered.resolve();
					await release.promise;
				});
				await entered.promise;
				const body = jest.fn(async (manager: EntityManager) => {
					facts.push('B:body');
					expect(await manager.query('SELECT * FROM records')).toEqual([{ id: 1, value: 'A' }]);
					await manager.query("UPDATE records SET value = 'B' WHERE id = 1");
				});
				const second = b.transactionWithWriteIntent(body);
				if (progress) {
					await second;
					expect(facts.indexOf('A:DML-ack')).toBeLessThan(facts.indexOf('B:submit:BEGIN IMMEDIATE TRANSACTION'));
					expect(facts.indexOf('A:ack:COMMIT')).toBeLessThan(facts.indexOf('B:ack:BEGIN IMMEDIATE TRANSACTION'));
					expect(facts.indexOf('B:ack:BEGIN IMMEDIATE TRANSACTION')).toBeLessThan(facts.indexOf('B:body'));
					expect(facts).toContain('B:ack:COMMIT');
					expect(await b.query('SELECT * FROM records')).toEqual([{ id: 1, value: 'B' }]);
				} else {
					await expect(second).rejects.toMatchObject({ driverError: { code: 'SQLITE_BUSY', errno: 5 } });
					expect(body).not.toHaveBeenCalled();
					expect(facts).toContain('B:error:BEGIN IMMEDIATE TRANSACTION');
					expect(facts).not.toContain('B:submit:COMMIT');
					release.resolve();
					await first;
					await b.transaction(() => Promise.resolve());
				}
				console.info('sqlite-write-admission-native', JSON.stringify({ progress, facts }));
			} finally {
				release.resolve();
				await first;
				if (b?.isInitialized) await b.destroy();
				if (a?.isInitialized) await a.destroy();
				await rm(directory, { recursive: true, force: true });
			}
		},
	);
});
