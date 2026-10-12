import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, DataSourceOptions, EntityManager, QueryRunner } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

interface ConnectionLease {
	runner: CoordinatedSqliteQueryRunner;
	active: boolean;
	release: () => void;
	aborted?: Error;
}

interface OperationContext {
	lease: ConnectionLease;
	children: Promise<void>;
	operations: Set<Promise<unknown>>;
	managedStart?: boolean;
	failedStart?: boolean;
}

interface ConnectionWaiter {
	runner: CoordinatedSqliteQueryRunner;
	resolve: (lease: ConnectionLease) => void;
	reject: (error: Error) => void;
	timer?: NodeJS.Timeout;
}

export interface SqliteCoordinationOptions {
	/** Queued work times out even if its owner is healthy; increase this for longer transactions. Default: 5s. */
	acquisitionTimeoutMs?: number;
}

/** One SQLite connection must have one owner until its whole transaction has settled. */
class SqliteConnectionCoordinator {
	private readonly context = new AsyncLocalStorage<OperationContext>();
	private readonly queue: ConnectionWaiter[] = [];
	private owner?: ConnectionLease;
	private failure?: Error;
	private closed = false;
	private acquisitionTimeoutMs = 5_000;

	get isClosed(): boolean {
		return this.closed;
	}

	configure(options: SqliteCoordinationOptions): void {
		if (options.acquisitionTimeoutMs !== undefined) {
			if (!Number.isFinite(options.acquisitionTimeoutMs) || options.acquisitionTimeoutMs <= 0) {
				throw new Error('SQLite acquisition timeout must be a positive finite number');
			}
			this.acquisitionTimeoutMs = options.acquisitionTimeoutMs;
		}
	}

	assertAvailable(): void {
		if (this.closed) throw new Error('SQLite DataSource has been destroyed; create a new DataSource instance');
		if (this.failure) throw this.failure;
	}

	close(): void {
		this.closed = true;
		if (this.owner) this.owner.active = false;
		this.owner = undefined;
		this.rejectWaiters(new Error('SQLite DataSource was destroyed while waiting for connection ownership'));
	}

	get currentRunner(): CoordinatedSqliteQueryRunner | undefined {
		const context = this.context.getStore();

		return context?.lease?.active ? context.lease.runner : undefined;
	}

	get isTransactionActive(): boolean {
		return this.owner?.runner.isTransactionActive ?? false;
	}

	detach<T>(operation: () => T): T {
		return this.context.exit(operation);
	}

	acquire(runner: CoordinatedSqliteQueryRunner): Promise<ConnectionLease> {
		this.assertAvailable();
		return new Promise<ConnectionLease>((resolve, reject) => {
			const waiter: ConnectionWaiter = { runner, resolve, reject };
			waiter.timer = setTimeout(() => {
				const index = this.queue.indexOf(waiter);
				if (index === -1) return;
				this.queue.splice(index, 1);
				reject(
					new Error(
						`Timed out after ${this.acquisitionTimeoutMs}ms waiting for SQLite connection ownership. ` +
							'Use runner.manager inside manual transactions; do not await independent database work or acquire other locks while holding a transaction.',
					),
				);
			}, this.acquisitionTimeoutMs);
			this.queue.push(waiter);
			this.admitNext();
		});
	}

	private admitNext(): void {
		if (this.owner || this.closed || this.failure) return;
		const waiter = this.queue.shift();
		if (!waiter) return;
		clearTimeout(waiter.timer);
		const lease: ConnectionLease = {
			runner: waiter.runner,
			active: true,
			release: () => {
				if (!lease.active) return;
				lease.active = false;
				if (this.owner === lease) this.owner = undefined;
				this.admitNext();
			},
		};
		this.owner = lease;

		waiter.resolve(lease);
	}

	private rejectWaiters(error: Error): void {
		for (const waiter of this.queue.splice(0)) {
			clearTimeout(waiter.timer);
			waiter.reject(error);
		}
	}

	run<T>(lease: ConnectionLease, operation: () => Promise<T>): Promise<T> {
		this.assertAvailable();
		if (lease?.aborted) throw lease.aborted;
		if (!lease?.active) return operation();

		const context: OperationContext = { lease, children: Promise.resolve(), operations: new Set() };
		return this.context.run(context, async () => {
			try {
				const result = await operation();
				await this.drainOperations(context);
				return result;
			} catch (error) {
				await this.drainOperations(context, false);
				throw error;
			}
		});
	}

	track<T>(operation: Promise<T>): Promise<T> {
		const context = this.context.getStore();
		if (!context?.lease.active) return operation;
		context.operations.add(operation);
		void operation.then(
			() => context.operations.delete(operation),
			() => context.operations.delete(operation),
		);
		return operation;
	}

	async drainCurrent(propagateFailure = true): Promise<void> {
		const context = this.context.getStore();
		if (context?.lease.active) await this.drainOperations(context, propagateFailure);
	}

	markFailedStart(): void {
		const context = this.context.getStore();
		if (context?.lease.active && context.managedStart) context.failedStart = true;
	}

	async managedTransaction<T>(args: unknown[], invoke: (args: unknown[]) => Promise<T>): Promise<T> {
		const context = this.context.getStore();
		const callbackIndex = typeof args[0] === 'function' ? 0 : 1;
		const callback = args[callbackIndex];
		const wrappedArgs = [...args];
		context.managedStart = true;
		if (typeof callback === 'function') {
			wrappedArgs[callbackIndex] = (...callbackArgs: unknown[]) => {
				// Manual starts inside the callback must never suppress its outer rollback.
				context.managedStart = false;
				context.failedStart = false;
				return Reflect.apply(callback, undefined, callbackArgs) as Promise<unknown>;
			};
		}
		try {
			return await invoke(wrappedArgs);
		} finally {
			// Failed-start suppression belongs only to TypeORM's immediate catch for this attempt.
			context.managedStart = false;
			context.failedStart = false;
		}
	}

	consumeFailedStart(): boolean {
		const context = this.context.getStore();
		if (!context?.failedStart) return false;
		context.failedStart = false;
		return true;
	}

	private async drainOperations(context: OperationContext, propagateFailure = true): Promise<void> {
		while (context.operations.size > 0) {
			const results = await Promise.allSettled([...context.operations]);
			const failed = results.find((result) => result.status === 'rejected');
			if (propagateFailure && failed?.status === 'rejected') throw failed.reason as unknown;
		}
	}

	/** Sibling nested transactions must not overlap their SAVEPOINT lifetimes. */
	async runNested<T>(operation: () => Promise<T>): Promise<T> {
		const context = this.context.getStore();
		if (!context?.lease.active) return operation();
		const previous = context.children;
		let unlock: () => void;
		context.children = new Promise<void>((resolve) => (unlock = resolve));
		await previous;
		try {
			return await this.run(context.lease, operation);
		} finally {
			unlock();
		}
	}

	poison(error: unknown): void {
		this.failure = new Error('SQLite transaction recovery failed; create a new DataSource to replace this connection', {
			cause: error,
		});
		this.rejectWaiters(this.failure);
	}
}

const coordinators = new WeakMap<DataSource, SqliteConnectionCoordinator>();

function coordinatorFor(dataSource: DataSource): SqliteConnectionCoordinator {
	let coordinator = coordinators.get(dataSource);
	if (!coordinator) {
		coordinator = new SqliteConnectionCoordinator();
		coordinators.set(dataSource, coordinator);
	}

	return coordinator;
}

/**
 * TypeORM's SQLite driver normally shares a QueryRunner as well as a connection. Independent
 * runners prevent another request from mistaking an open transaction for its own. The coordinator
 * still protects the shared physical connection, including reads and transaction:false writes.
 * Started nested manager operations and queries are drained before transaction settlement.
 * Draining keeps started work inside its scope; callers must await it to receive every failure.
 * Transaction callbacks should await their database work; intentionally detached work should
 * use outsideSqliteTransaction(). Manual runners/managers are scoped to one caller and must not
 * be shared by unrelated requests or run concurrent transaction-control methods.
 * Keep the internal driver imports covered by real-driver tests when upgrading TypeORM.
 */
export class SqliteDataSource extends DataSource {
	constructor(options: DataSourceOptions, coordinationOptions: SqliteCoordinationOptions = {}) {
		super(options);
		if (options.type !== 'sqlite') throw new Error('SqliteDataSource requires the sqlite driver');
		const coordinator = coordinatorFor(this);
		coordinator.configure(coordinationOptions);
		this.driver.createQueryRunner = () => new CoordinatedSqliteQueryRunner(this.driver as SqliteDriver, coordinator);
	}

	async initialize(): Promise<this> {
		coordinatorFor(this).assertAvailable();
		return super.initialize();
	}

	async destroy(): Promise<void> {
		coordinatorFor(this).close();
		await super.destroy();
	}

	createQueryRunner(mode: 'master' | 'slave' = 'master'): QueryRunner {
		return coordinatorFor(this).currentRunner ?? super.createQueryRunner(mode);
	}

	createEntityManager(queryRunner?: QueryRunner): EntityManager {
		const manager = super.createEntityManager(queryRunner);
		const coordinator = coordinatorFor(this);

		// These are TypeORM's complete transaction-shaped entry points. Use the original methods
		// on a scoped manager so entity listeners/subscribers and repository APIs are preserved.
		for (const method of ['transaction', 'save', 'remove', 'softRemove', 'recover'] as const) {
			const original = manager[method];
			Object.defineProperty(manager, method, {
				value: (...args: unknown[]) => {
					const execute = async () => {
						const runner = (manager.queryRunner ?? this.createQueryRunner()) as CoordinatedSqliteQueryRunner;
						return runner.withConnection(() => {
							const invoke = (parameters: unknown[]) =>
								Reflect.apply(original, runner.manager, parameters) as Promise<unknown>;
							return method === 'transaction' ? coordinator.managedTransaction(args, invoke) : invoke(args);
						});
					};

					return coordinator.track(method === 'transaction' ? coordinator.runNested(execute) : execute());
				},
				configurable: true,
				writable: true,
			});
		}

		return manager;
	}
}

/** Nest's factory installs coordination before schema synchronization or migrations can run. */
export function createSqliteDataSource(options: DataSourceOptions): Promise<SqliteDataSource> {
	return new SqliteDataSource(options).initialize();
}

class CoordinatedSqliteQueryRunner extends SqliteQueryRunner {
	private lease?: ConnectionLease;
	private operationDepth = 0;
	private transactionControlDepth = 0;

	constructor(
		driver: SqliteDriver,
		private readonly coordinator: SqliteConnectionCoordinator,
	) {
		super(driver);
	}

	async withConnection<T>(operation: () => Promise<T>): Promise<T> {
		this.coordinator.assertAvailable();
		const ownsLease = !this.lease?.active;
		if (ownsLease) this.lease = await this.coordinator.acquire(this);
		const lease = this.lease;
		this.operationDepth++;
		try {
			return await this.coordinator.run(lease, operation);
		} finally {
			this.operationDepth--;
			this.releaseIfSettled();
		}
	}

	async query(query: string, parameters?: unknown[], useStructuredResult = false): Promise<any> {
		const command = query.replace(/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, '');
		if (this.transactionControlDepth === 0 && /^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(command)) {
			throw new Error('Use QueryRunner transaction methods for SQLite transaction control');
		}

		return this.coordinator.track(this.withConnection(() => super.query(query, parameters, useStructuredResult)));
	}

	async startTransaction(isolationLevel?: IsolationLevel): Promise<void> {
		this.coordinator.assertAvailable();
		if (!this.lease?.active) this.lease = await this.coordinator.acquire(this);
		const previousDepth = this.transactionDepth;
		try {
			await this.withTransactionControl(() => super.startTransaction(isolationLevel));
		} catch (error) {
			// TypeORM sets isTransactionActive before BEGIN and does not restore it on SQL failure.
			// Only this owner can recover the connection; another queued request cannot be rolled back.
			if (previousDepth === 0) await this.recoverTransaction();
			else {
				// A failing BeforeTransactionStart subscriber clears TypeORM's flag even though the
				// outer transaction remains open. Preserve its ownership and depth.
				this.isTransactionActive = true;
				if (this.transactionDepth > previousDepth) await this.rollbackTransaction();
				this.transactionDepth = previousDepth;
				// EntityManager.transaction always attempts rollback after a failed start. That
				// attempt belongs to this failed nested scope, not the still-open outer transaction.
				this.coordinator.markFailedStart();
			}
			throw error;
		} finally {
			this.releaseIfSettled();
		}
	}

	async commitTransaction(): Promise<void> {
		try {
			await this.coordinator.drainCurrent();
			await this.withTransactionControl(() => super.commitTransaction());
		} finally {
			this.releaseIfSettled();
		}
	}

	async rollbackTransaction(): Promise<void> {
		if (this.coordinator.consumeFailedStart()) return;

		try {
			await this.coordinator.drainCurrent(false);
			await this.withTransactionControl(() => super.rollbackTransaction());
		} catch (error) {
			if (this.lease?.active && this.isTransactionActive) await this.recoverTransaction();
			throw error;
		} finally {
			this.releaseIfSettled();
		}
	}

	async release(): Promise<void> {
		if (this.coordinator.isClosed) {
			// TypeORM releases runners in finally blocks. Teardown must not mask the original
			// cancellation or attempt SQL on the closed physical connection.
			this.isTransactionActive = false;
			this.transactionDepth = 0;
			await super.release();
			return;
		}
		// A manual runner abandoned by its caller must not leave every subsequent request waiting.
		// TypeORM also releases borrowed runners after global queries inside an operation's hooks.
		while (this.operationDepth === 0 && this.isTransactionActive) await this.rollbackTransaction();
		await super.release();
		this.releaseIfSettled();
	}

	private releaseIfSettled(): void {
		if (this.operationDepth === 0 && !this.isTransactionActive) this.lease?.release();
	}

	private withTransactionControl(operation: () => Promise<void>): Promise<void> {
		return this.coordinator.run(this.lease, async () => {
			this.transactionControlDepth++;
			try {
				await operation();
			} finally {
				this.transactionControlDepth--;
			}
		});
	}

	private async recoverTransaction(): Promise<void> {
		const hadTransaction = this.transactionDepth > 0;
		const abortedNestedTransaction = this.transactionDepth > 1;
		try {
			// Bypass a failing rollback subscriber/query wrapper for the last-resort cleanup. sqlite3
			// reports a failed BEGIN as "no transaction is active"; that is a successful clean state.
			await new Promise<void>((resolve, reject) => {
				const connection = this.driver.databaseConnection as {
					run: (sql: string, callback: (error: Error | null) => void) => unknown;
				};
				connection.run('ROLLBACK', (error: Error | null) => {
					if (!error || /no transaction is active/i.test(error.message)) resolve();
					else reject(error);
				});
			});
		} catch (error) {
			// Never hand an uncertain, possibly open transaction to a different request.
			this.coordinator.poison(error);
		} finally {
			this.isTransactionActive = false;
			this.transactionDepth = 0;
		}
		if (hadTransaction) {
			// Metadata/cache subscribers must observe the cleanup even if the ordinary ROLLBACK SQL
			// or its before hook failed. A subscriber failure cannot undo the clean connection state.
			try {
				await this.coordinator.run(this.lease, () => this.broadcaster.broadcast('AfterTransactionRollback'));
			} catch {
				// The transaction caller still receives its original failure.
			}
		}
		if (abortedNestedTransaction && this.lease?.active) {
			// Last-resort ROLLBACK closes every savepoint. Catching the nested error must not let
			// its parent silently continue with autocommitted writes outside the original scope.
			this.lease.aborted = new Error('Nested SQLite transaction recovery aborted the owning transaction scope');
		}
	}
}

/** Observe the physical connection, rather than a newly created request's independent runner. */
export function isSqliteTransactionActive(dataSource: DataSource): boolean {
	return coordinators.get(dataSource)?.isTransactionActive ?? dataSource.createQueryRunner().isTransactionActive;
}

/** Fire-and-forget listeners must read committed state, outside the emitting operation's lease. */
export function outsideSqliteTransaction<T>(dataSource: DataSource, operation: () => T): T {
	const coordinator = coordinators.get(dataSource);

	return coordinator ? coordinator.detach(operation) : operation();
}
