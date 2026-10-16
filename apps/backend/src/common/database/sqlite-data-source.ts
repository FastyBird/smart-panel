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
	parent?: OperationContext;
	active: boolean;
	children: Promise<void>;
	operations: Map<Promise<unknown>, OperationContext>;
	managedStart?: boolean;
	failedStart?: boolean;
}

/** Internal admission evidence only; a submitted native error is never proof of rollback. */
export type SqliteGuardedCommitOutcome = 'pending' | 'refused' | 'committed' | 'unknown' | 'rolled_back';

export interface SqliteCommitGuardReceipt {
	readonly outcome: SqliteGuardedCommitOutcome;
}

export class SqliteCommitGuardRefusedError extends Error {
	constructor(cause?: unknown) {
		super('SQLite outer COMMIT admission was refused before native submission', { cause });
		this.name = 'SqliteCommitGuardRefusedError';
	}
}

interface GuardedCommit {
	lease: ConnectionLease;
	guards: Array<() => boolean>;
	phase: 'starting' | 'open' | 'sealed' | 'submitted' | 'committed' | 'rolling_back' | 'settled';
	outcome: SqliteGuardedCommitOutcome;
	childFailure?: { cause: unknown };
}

type NativeQueryCallback = (this: unknown, error: Error | null, rows?: unknown[]) => void;

interface NativeSqliteConnection {
	all(query: string, parameters: unknown[], callback: NativeQueryCallback): unknown;
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
	private readonly contexts = new Set<OperationContext>();
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

		return this.runContext(this.createContext(lease), operation);
	}

	private createContext(lease: ConnectionLease): OperationContext {
		const parent = this.context.getStore();
		return {
			lease,
			parent: parent?.lease === lease ? parent : undefined,
			active: true,
			children: Promise.resolve(),
			operations: new Map(),
		};
	}

	private runContext<T>(context: OperationContext, operation: () => Promise<T>): Promise<T> {
		this.contexts.add(context);
		return this.context.run(context, async () => {
			try {
				const result = await operation();
				await this.drainOperations(context);
				return result;
			} catch (error) {
				await this.drainOperations(context, false);
				throw error;
			} finally {
				context.active = false;
				this.contexts.delete(context);
			}
		});
	}

	track<T>(operation: () => Promise<T>, nested = false): Promise<T> {
		const parent = this.context.getStore();
		if (!parent?.lease.active) return operation();
		const child = this.createContext(parent.lease);
		const recordFailure = parent.lease.runner.captureChildFailureRecorder(parent.lease);
		const promise = this.runContext(child, nested ? () => this.runNested(operation, parent) : operation);
		parent.operations.set(promise, child);
		void promise.then(
			() => parent.operations.delete(promise),
			(cause: unknown) => {
				recordFailure?.(cause);
				parent.operations.delete(promise);
			},
		);
		return promise;
	}

	captureCommitContext(lease: ConnectionLease): OperationContext {
		const context = this.context.getStore();
		if (!context?.active || context.lease !== lease || !lease.active || this.owner !== lease) {
			throw new Error('SQLite COMMIT guard requires its current owning connection lease');
		}
		return context;
	}

	/** Drain every same-lease child except promises whose operation is awaiting this exact COMMIT. */
	async drainCommitChildren(context: OperationContext, dispatch: () => void): Promise<void> {
		while (true) {
			this.assertAvailable();
			if (!context.active || !context.lease.active || this.owner !== context.lease) {
				throw new Error('SQLite guarded COMMIT lease expired');
			}
			const ancestors = new Set<OperationContext>();
			for (let ancestor: OperationContext | undefined = context; ancestor; ancestor = ancestor.parent) {
				ancestors.add(ancestor);
			}
			const children = new Set<Promise<unknown>>();
			for (const candidate of this.contexts) {
				if (candidate.lease !== context.lease) continue;
				for (const [promise, child] of candidate.operations) {
					if (!ancestors.has(child)) children.add(promise);
				}
			}
			if (children.size === 0) {
				dispatch();
				return;
			}
			const results = await Promise.allSettled(children);
			const failed = results.find((result) => result.status === 'rejected');
			if (failed?.status === 'rejected') throw failed.reason as unknown;
		}
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
			const results = await Promise.allSettled([...context.operations.keys()]);
			const failed = results.find((result) => result.status === 'rejected');
			if (propagateFailure && failed?.status === 'rejected') throw failed.reason as unknown;
		}
	}

	/** Sibling nested transactions must not overlap their SAVEPOINT lifetimes. */
	async runNested<T>(operation: () => Promise<T>, context = this.context.getStore()): Promise<T> {
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

/** Keep connection ownership shared by every runner of the same data source. */
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

					return coordinator.track(execute, method === 'transaction');
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
	private guardedCommit?: GuardedCommit;
	private readonly nativeCommitContext = new AsyncLocalStorage<GuardedCommit | undefined>();

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

		const scope = this.guardedCommit;
		if (scope?.guards.length && (scope.phase === 'sealed' || scope.phase === 'submitted')) {
			throw new Error('SQLite guarded COMMIT is sealed against new candidate queries');
		}
		const outerCommit = command === 'COMMIT' && this.transactionDepth === 1 ? scope : undefined;
		return this.coordinator.track(() =>
			this.withConnection(() =>
				this.nativeCommitContext.run(outerCommit, () => super.query(query, parameters, useStructuredResult)),
			),
		);
	}

	async startTransaction(isolationLevel?: IsolationLevel): Promise<void> {
		this.coordinator.assertAvailable();
		if (!this.lease?.active) this.lease = await this.coordinator.acquire(this);
		const previousDepth = this.transactionDepth;
		// Start subscribers already run on this lease: retain their failures before the body can attach guards.
		const outerScope: GuardedCommit | undefined =
			previousDepth === 0 ? { lease: this.lease, guards: [], phase: 'starting', outcome: 'pending' } : undefined;
		if (outerScope) this.guardedCommit = outerScope;
		try {
			await this.withTransactionControl(() => super.startTransaction(isolationLevel));
			if (outerScope) outerScope.phase = 'open';
		} catch (error) {
			// TypeORM sets isTransactionActive before BEGIN and does not restore it on SQL failure.
			// Only this owner can recover the connection; another queued request cannot be rolled back.
			if (previousDepth === 0) {
				if (outerScope) outerScope.phase = 'rolling_back';
				await this.recoverTransaction();
			} else {
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
			if (outerScope) this.settleCommitScope();
			this.releaseIfSettled();
		}
	}

	async commitTransaction(): Promise<void> {
		try {
			await this.coordinator.drainCurrent();
			await this.withTransactionControl(() => super.commitTransaction());
		} finally {
			this.settleCommitScope();
			this.releaseIfSettled();
		}
	}

	async rollbackTransaction(): Promise<void> {
		if (this.coordinator.consumeFailedStart()) return;
		if (this.guardedCommit && this.transactionDepth === 1) this.guardedCommit.phase = 'rolling_back';

		try {
			await this.coordinator.drainCurrent(false);
			await this.withTransactionControl(() => super.rollbackTransaction());
		} catch (error) {
			if (this.lease?.active && this.isTransactionActive) await this.recoverTransaction();
			throw error;
		} finally {
			this.settleCommitScope();
			this.releaseIfSettled();
		}
	}

	/** Retain at most the first rejection, even if it settles before the guarded drain begins. */
	captureChildFailureRecorder(lease: ConnectionLease): ((cause: unknown) => void) | undefined {
		const scope = this.guardedCommit;
		if (!scope || scope.lease !== lease || (scope.phase !== 'starting' && scope.phase !== 'open')) return undefined;
		return (cause: unknown) => {
			if (
				scope === this.guardedCommit &&
				lease.active &&
				(scope.phase === 'starting' || scope.phase === 'open') &&
				!scope.childFailure
			) {
				scope.childFailure = { cause };
			}
		};
	}

	registerCommitGuard(manager: EntityManager, guard: () => boolean): SqliteCommitGuardReceipt {
		const scope = this.guardedCommit;
		if (manager.queryRunner !== this || !scope || !this.isTransactionActive || scope.phase !== 'open') {
			throw new Error('SQLite COMMIT guards require an open transaction on its exact scoped manager');
		}
		this.coordinator.captureCommitContext(scope.lease);
		scope.guards.push(guard);
		// No disposer: inner helpers cannot silently remove an outer transaction's admission requirement.
		return {
			get outcome() {
				return scope.outcome;
			},
		};
	}

	async connect(): Promise<NativeSqliteConnection> {
		const connection = (await super.connect()) as NativeSqliteConnection;
		const scope = this.nativeCommitContext.getStore();
		if (!scope) return connection;
		const context = this.coordinator.captureCommitContext(scope.lease);
		// This handle belongs only to this outer COMMIT query. Never modify the driver's shared native object.
		return new Proxy(connection, {
			get: (target, property) => {
				if (property === 'all') {
					return (query: string, parameters: unknown[], callback: NativeQueryCallback) => {
						if (query !== 'COMMIT' || scope.guards.length === 0) {
							return target.all(query, parameters, callback);
						}
						this.dispatchGuardedCommit(scope, context, target, query, parameters, callback);
						return target;
					};
				}
				const value: unknown = Reflect.get(target, property);
				return typeof value === 'function'
					? (...args: unknown[]) => Reflect.apply(value, target, args) as unknown
					: value;
			},
		});
	}

	private dispatchGuardedCommit(
		scope: GuardedCommit,
		context: OperationContext,
		connection: NativeSqliteConnection,
		query: string,
		parameters: unknown[],
		callback: NativeQueryCallback,
	): void {
		// TypeORM's busy timer reuses this same facade, original scope and context on EVERY attempt.
		let delivered = false;
		const deliver: NativeQueryCallback = function (error, rows) {
			if (delivered) return;
			delivered = true;
			callback.call(this, error, rows);
		};
		void this.coordinator
			.drainCommitChildren(context, () => {
				let submitted = false;
				try {
					if (
						scope !== this.guardedCommit ||
						!scope.lease.active ||
						this.transactionDepth !== 1 ||
						(scope.phase !== 'open' && scope.phase !== 'sealed')
					) {
						throw new Error('SQLite outer COMMIT scope expired');
					}
					scope.phase = 'sealed';
					if (scope.childFailure) throw new SqliteCommitGuardRefusedError(scope.childFailure.cause);
					for (const guard of scope.guards) {
						if (guard() !== true) throw new SqliteCommitGuardRefusedError();
					}
					scope.phase = 'submitted';
					scope.outcome = 'unknown';
					submitted = true;
					// UNKNOWN until an actual native acknowledgement; dispatch alone is never commit confirmation.
					// No await, subscriber, timer or recapture between the ORIGINAL pure guards and native dispatch.
					connection.all(query, parameters, function (error, rows) {
						if (!error) {
							scope.phase = 'committed';
							scope.outcome = 'committed';
						} else if (error.toString().includes('SQLITE_BUSY:')) {
							scope.phase = 'sealed';
						} else {
							scope.outcome = 'unknown';
						}
						deliver.call(this, error, rows);
					});
				} catch (error) {
					if (delivered) return;
					if (submitted) {
						scope.outcome = 'unknown';
						deliver.call(
							connection,
							error instanceof Error ? error : new Error('Native COMMIT dispatch threw', { cause: error }),
						);
					} else {
						this.refuseCommit(scope, connection, deliver, error);
					}
				}
			})
			.catch((error: unknown) => this.refuseCommit(scope, connection, deliver, error));
	}

	private refuseCommit(
		scope: GuardedCommit,
		connection: NativeSqliteConnection,
		callback: NativeQueryCallback,
		cause: unknown,
	): void {
		scope.phase = 'sealed';
		scope.outcome = 'refused';
		// Deliver through the callback even on a busy TIMER retry, so TypeORM's original Promise settles.
		callback.call(
			connection,
			cause instanceof SqliteCommitGuardRefusedError ? cause : new SqliteCommitGuardRefusedError(cause),
		);
	}

	private settleCommitScope(): void {
		const scope = this.guardedCommit;
		if (!scope || this.isTransactionActive || this.transactionDepth !== 0) return;
		if (scope.outcome === 'pending') scope.outcome = 'rolled_back';
		scope.phase = 'settled';
		scope.childFailure = undefined;
		this.guardedCommit = undefined;
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

/** Internal transaction admission only. Same-manager nested helpers attach to the owning OUTER scope. */
export function registerSqliteCommitGuard(manager: EntityManager, guard: () => boolean): SqliteCommitGuardReceipt {
	if (!(manager.queryRunner instanceof CoordinatedSqliteQueryRunner)) {
		throw new Error('SQLite COMMIT guards require a coordinated scoped manager');
	}
	return manager.queryRunner.registerCommitGuard(manager, guard);
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
