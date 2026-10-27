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
	accepting: boolean;
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
	observed?: true;
	childFailure?: { cause: unknown };
	noMutation?: NoMutationEvidence;
}

type NativeQueryCallback = (this: unknown, error: Error | null, rows?: unknown[]) => void;

interface NativeSqliteConnection {
	run: (query: string, parameters: unknown[], callback: NativeQueryCallback) => unknown;
	all: (query: string, parameters: unknown[], callback: NativeQueryCallback) => unknown;
}

/** Internal, opaque and scoped to the original outer native transaction. */
export interface SqliteReadCheckpoint {
	readonly kind: 'sqlite-read-checkpoint';
}
export interface SqliteNoMutationWindow {
	reserveZeroRows(table: string, column: string): Promise<void>;
	beginReads(): SqliteReadCheckpoint;
	armUnchanged(checkpoint: SqliteReadCheckpoint): void;
	applied(): void;
	readonly outcome: SqliteGuardedCommitOutcome;
}
interface NoMutationTicket {
	readonly scope: GuardedCommit;
	sql: string | undefined;
	readonly control: boolean;
	active: boolean;
	dispatched: boolean;
	retry: boolean;
}
interface NoMutationEvidence {
	decision: 'undecided' | 'unchanged' | 'applied' | 'refused';
	attempts: bigint;
	mutations: bigint;
	anomaly?: { cause: unknown };
	pending: Set<NoMutationTicket>;
	reservation?: string;
	current: () => boolean;
	read: (sql: string) => boolean;
	native: NativeSqliteConnection;
	all: NativeSqliteConnection['all'];
	run: NativeSqliteConnection['run'];
}
const noMutationCounterLimit = (1n << 64n) - 1n;

/** Closed SELECT grammar for ordinary ORM tables. Unknown SQL is a mutation attempt, not a read hint.
 * No comments, functions except COUNT, virtual tables, views, PRAGMA or compound statements.
 * This does not sandbox raw handles, private/prototype rewrites or native extensions/UDFs.
 */
function isNoMutationRead(sql: string, tables: ReadonlySet<string>): boolean {
	if (typeof sql !== 'string') return false;
	const tokens: Array<{ text: string; kind: 'word' | 'identifier' | 'literal' | 'symbol' }> = [];
	const pattern =
		/\s+|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]])*\]|'(?:[^']|'')*'|\?(?:\d+)?|[:@$][A-Za-z_][A-Za-z_0-9]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|<>|!=|<=|>=|\|\||[(),.*+/%=<>-]/gy;
	let offset = 0;
	while (offset < sql.length) {
		pattern.lastIndex = offset;
		const match = pattern.exec(sql);
		if (!match || sql.includes('\0')) return false;
		offset = pattern.lastIndex;
		const text = match[0];
		if (/^\s+$/.test(text)) continue;
		const kind = /^["`[]/.test(text)
			? 'identifier'
			: /^[A-Za-z_]/.test(text)
				? 'word'
				: /^[?'\d.:@$]/.test(text)
					? 'literal'
					: 'symbol';
		tokens.push({ text, kind });
	}
	let index = 0;
	const peek = () => tokens[index]?.text.toUpperCase();
	const take = (text: string) => {
		if (peek() !== text) return false;
		index++;
		return true;
	};
	const need = (text: string) => {
		if (!take(text)) throw new Error('syntax');
	};
	const reserved = new Set(
		'SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER CROSS ON AS DISTINCT AND OR NOT IS NULL TRUE FALSE BETWEEN IN ORDER BY GROUP HAVING LIMIT OFFSET ASC DESC UNION EXCEPT INTERSECT CASE WHEN THEN ELSE END COLLATE'.split(
			' ',
		),
	);
	const identifier = () => {
		const token = tokens[index++];
		if (!token || (token.kind !== 'identifier' && (token.kind !== 'word' || reserved.has(token.text.toUpperCase()))))
			throw new Error('identifier');
		return token.kind === 'identifier' ? token.text.slice(1, -1).replace(/""/g, '"').replace(/``/g, '`') : token.text;
	};
	const alias = () => {
		if (take('AS')) identifier();
		else if (tokens[index]?.kind === 'identifier' || (tokens[index]?.kind === 'word' && !reserved.has(peek())))
			identifier();
	};
	const list = (operation: () => void) => {
		operation();
		while (take(',')) operation();
	};
	const expression = (minimum = 0): void => {
		if (take('NOT') || take('+') || take('-')) expression(7);
		else if (take('(')) {
			if (peek() === 'SELECT') select();
			else expression();
			need(')');
		} else if (tokens[index]?.kind === 'literal' || ['NULL', 'TRUE', 'FALSE'].includes(peek())) index++;
		else if (take('*')) {
			/* column wildcard */
		} else {
			const token = tokens[index];
			const name = identifier();
			if (take('(')) {
				if (token.kind !== 'word' || name.toUpperCase() !== 'COUNT') throw new Error('function');
				take('DISTINCT');
				expression();
				need(')');
			} else if (take('.')) {
				if (!take('*')) identifier();
				if (peek() === '(') throw new Error('qualified function');
			}
		}
		while (true) {
			const op = peek();
			const precedence =
				op === 'OR'
					? 1
					: op === 'AND'
						? 2
						: ['=', '!=', '<>', '<', '>', '<=', '>=', 'IS', 'IN', 'BETWEEN', 'NOT'].includes(op)
							? 3
							: ['+', '-', '||'].includes(op)
								? 4
								: ['*', '/', '%'].includes(op)
									? 5
									: 0;
			if (!precedence || precedence <= minimum) return;
			index++;
			let comparison = op;
			if (op === 'NOT') {
				comparison = peek();
				if (!['IN', 'BETWEEN'].includes(comparison)) throw new Error('not');
				index++;
			}
			if (comparison === 'IS') take('NOT');
			if (comparison === 'IN') {
				need('(');
				if (peek() === 'SELECT') select();
				else if (peek() !== ')') list(() => expression());
				need(')');
			} else if (comparison === 'BETWEEN') {
				expression(3);
				need('AND');
				expression(3);
			} else expression(precedence);
		}
	};
	const source = () => {
		if (take('(')) {
			select();
			need(')');
		} else {
			const table = identifier();
			if (!tables.has(table) || table.toLowerCase().startsWith('pragma_') || peek() === '(' || peek() === '.')
				throw new Error('table');
		}
		alias();
	};
	const select = () => {
		need('SELECT');
		take('DISTINCT');
		list(() => {
			expression();
			alias();
		});
		if (take('FROM')) {
			source();
			while (true) {
				if (take(',')) {
					source();
					continue;
				}
				const join = take('LEFT') || take('INNER') || take('CROSS');
				if (join) take('OUTER');
				if (!take('JOIN')) {
					if (join) throw new Error('join');
					break;
				}
				source();
				if (take('ON')) expression();
			}
		}
		if (take('WHERE')) expression();
		if (take('GROUP')) {
			need('BY');
			list(() => expression());
		}
		if (take('HAVING')) expression();
		if (take('ORDER')) {
			need('BY');
			list(() => {
				expression();
				if (!take('ASC')) take('DESC');
			});
		}
		if (take('LIMIT')) {
			expression();
			if (take(',') || take('OFFSET')) expression();
		}
	};
	try {
		select();
		return index === tokens.length;
	} catch {
		return false;
	}
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
			accepting: true,
			children: Promise.resolve(),
			operations: new Map(),
		};
	}

	private runContext<T>(context: OperationContext, operation: () => Promise<T>): Promise<T> {
		this.contexts.add(context);
		return this.context.run(context, async () => {
			try {
				const result = await operation();
				await this.drainOperations(context, true, true);
				return result;
			} catch (error) {
				await this.drainOperations(context, false, true);
				throw error;
			} finally {
				context.active = false;
				this.contexts.delete(context);
			}
		});
	}

	track<T>(operation: () => Promise<T>, nested = false): Promise<T> {
		let parent = this.context.getStore();
		if (!parent?.lease.active) return operation();
		const lease = parent.lease;
		// A completed query's continuation can still join its live transaction. Enroll that work
		// under a live ancestor so ordinary settlement and guarded COMMIT both see its promise.
		while (!parent.active || !parent.accepting) {
			parent = parent.parent;
			if (!parent || parent.lease !== lease) {
				return Promise.reject(new Error('SQLite operation requires an active owning context on its original lease'));
			}
		}
		const owner = parent;
		const child = this.createContext(lease);
		const recordFailure = owner.lease.runner.captureChildFailureRecorder(owner.lease);
		const promise = this.runContext(child, nested ? () => this.runNested(operation, owner) : operation);
		owner.operations.set(promise, child);
		void promise.then(
			() => owner.operations.delete(promise),
			(cause: unknown) => {
				recordFailure?.(cause);
				owner.operations.delete(promise);
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

	private async drainOperations(context: OperationContext, propagateFailure = true, retire = false): Promise<void> {
		while (context.operations.size > 0) {
			const results = await Promise.allSettled([...context.operations.keys()]);
			const failed = results.find((result) => result.status === 'rejected');
			if (propagateFailure && failed?.status === 'rejected') throw failed.reason as unknown;
		}
		// Close enrollment in the same turn as the final empty check, before the caller awaits us.
		// Ownership remains active until runContext finishes; native COMMIT still checks that authority.
		if (retire) context.accepting = false;
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

/** Match SQLite enum DDL without losing CHECK presence changes omitted by TypeORM. */
function configureSqliteSchemaComparison(driver: SqliteDriver): void {
	const normalizeType = driver.normalizeType.bind(driver) as SqliteDriver['normalizeType'];
	const findChangedColumns = driver.findChangedColumns.bind(driver) as SqliteDriver['findChangedColumns'];

	// createFullType() emits varchar for every enum, including those declared as text.
	driver.normalizeType = (column) => ('enum' in column && column.enum ? 'varchar' : normalizeType(column));
	driver.findChangedColumns = (tableColumns, columnMetadatas) => {
		const changed = new Set(findChangedColumns(tableColumns, columnMetadatas));

		// Keep every original finding, in metadata order, once. New columns remain
		// the schema builder's responsibility; only compare CHECKs on existing columns.
		return [...new Set(columnMetadatas)].filter(
			(column) =>
				changed.has(column) ||
				tableColumns.some(
					(loaded) => loaded.name === column.databaseName && Boolean(loaded.enum) !== Boolean(column.enum),
				),
		);
	};
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
		configureSqliteSchemaComparison(this.driver as SqliteDriver);
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

	/** Fresh writer admission. Opt-in BeforeStart and pending BEGIN observers must be SQL-free. */
	async transactionWithWriteIntent<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
		const coordinator = coordinatorFor(this);
		coordinator.assertAvailable();
		if (!this.isInitialized) throw new Error('SQLite write admission requires an initialized DataSource');
		if (coordinator.currentRunner) throw new Error('SQLite write admission requires a fresh connection lease');
		const runner = this.createQueryRunner() as CoordinatedSqliteQueryRunner;
		return runner.transactionWithWriteIntent(callback);
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
	private writeIntentRequested = false;
	private writeAdmission?: 'pending' | 'armed';
	private readonly nativeCommitContext = new AsyncLocalStorage<GuardedCommit | undefined>();
	private readonly noMutationQuery = new AsyncLocalStorage<NoMutationTicket>();
	private noMutationControl?: { scope: GuardedCommit; sql: string };

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
		const ticket = this.recordNoMutationAttempt(query);
		try {
			if (this.writeAdmission) {
				// Consume the internal permit before any await or query observer can reenter.
				const permitted = this.writeAdmission === 'armed' && query === 'BEGIN IMMEDIATE TRANSACTION';
				this.writeAdmission = 'pending';
				if (!permitted) {
					return this.coordinator.track(() =>
						Promise.reject(new Error('SQLite write admission forbids queries before BEGIN acknowledgement')),
					);
				}
			}
			const command = query.replace(/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, '');
			if (this.transactionControlDepth === 0 && /^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(command)) {
				throw new Error('Use QueryRunner transaction methods for SQLite transaction control');
			}

			const scope = this.guardedCommit;
			if (scope?.guards.length && (scope.phase === 'sealed' || scope.phase === 'submitted')) {
				throw new Error('SQLite guarded COMMIT is sealed against new candidate queries');
			}
			const outerCommit = command === 'COMMIT' && this.transactionDepth === 1 ? scope : undefined;
			// Keep the original nonparticipating path, including its promise/child settlement topology.
			if (!ticket)
				return this.coordinator.track(() =>
					this.withConnection(() =>
						this.nativeCommitContext.run(outerCommit, () => super.query(query, parameters, useStructuredResult)),
					),
				);
			return await this.coordinator.track(() =>
				this.withConnection(async () => {
					try {
						return (await this.noMutationQuery.run(ticket, () =>
							this.nativeCommitContext.run(outerCommit, () => super.query(query, parameters, useStructuredResult)),
						)) as unknown;
					} finally {
						// Settle the original ticket INSIDE the tracked operation, before its promise is removed
						// from the coordinator. The caller's outer finally runs a later microtask.
						if (ticket) {
							ticket.active = false;
							ticket.sql = undefined;
							ticket.scope.noMutation?.pending.delete(ticket);
						}
					}
				}),
			);
		} finally {
			if (ticket) {
				ticket.active = false;
				ticket.sql = undefined;
				ticket.scope.noMutation?.pending.delete(ticket);
			}
		}
	}

	captureNoMutationWindow(manager: EntityManager, ownerCurrent: () => boolean): SqliteNoMutationWindow {
		const receipt = this.observeOuterOutcome(manager); // FIRST, before any candidate state/read.
		const scope = this.guardedCommit;
		if (scope.noMutation) throw new Error('Original SQLite no-mutation window already exists');
		const context = this.coordinator.captureCommitContext(scope.lease);
		const source = this.connection,
			driver = this.driver,
			native = driver.databaseConnection as NativeSqliteConnection;
		const pin = (target: object, keys: string[]) => {
			const prototype = Object.getPrototypeOf(target) as object;
			const descriptor = (key: string) => {
				for (let owner: object | null = target; owner; owner = Object.getPrototypeOf(owner) as object | null) {
					const value = Object.getOwnPropertyDescriptor(owner, key);
					if (value) return { owner, value };
				}
				return undefined;
			};
			const fields = keys.map((key) => descriptor(key));
			if (fields.some((field) => field && !('value' in field.value)))
				throw new Error('SQLite original dispatch accessor is unsupported');
			return () =>
				Object.getPrototypeOf(target) === prototype &&
				keys.every((key, index) => {
					const before = fields[index],
						after = descriptor(key);
					return before === undefined
						? after === undefined
						: after !== undefined &&
								before.owner === after.owner &&
								'value' in after.value &&
								(['value', 'writable', 'enumerable', 'configurable'] as const).every(
									(field) => before.value[field] === after.value[field],
								);
				});
		};
		const sourcePin = pin(source, ['isInitialized', 'driver', 'manager', 'query', 'createQueryRunner']);
		const driverPin = pin(driver, ['databaseConnection', 'connection']);
		const runnerPin = pin(this, [
			'query',
			'connect',
			'startTransaction',
			'commitTransaction',
			'rollbackTransaction',
			'release',
			'manager',
			'connection',
			'driver',
			'broadcaster',
		]);
		const managerPin = pin(manager, ['queryRunner', 'connection', 'query']);
		const broadcasterPin = pin(this.broadcaster, [
			'broadcast',
			'broadcastBeforeQueryEvent',
			'broadcastBeforeTransactionCommitEvent',
		]);
		const all = native.all,
			run = native.run;
		const nativePin = pin(native, ['all', 'run']);
		const tables = new Set(
			source.entityMetadatas.filter((meta) => meta.tableType !== 'view').map((meta) => meta.tableName),
		);
		const evidence: NoMutationEvidence = {
			decision: 'undecided',
			attempts: 0n,
			mutations: 0n,
			pending: new Set(),
			native,
			all,
			run,
			read: (sql) => isNoMutationRead(sql, tables),
			current: () =>
				runnerPin() &&
				managerPin() &&
				sourcePin() &&
				driverPin() &&
				nativePin() &&
				broadcasterPin() &&
				scope === this.guardedCommit &&
				scope.lease === this.lease &&
				scope.lease.active &&
				context.active &&
				this.coordinator.currentRunner === this &&
				!this.coordinator.isClosed &&
				source.isInitialized &&
				this.connection === source &&
				this.driver === driver &&
				driver.databaseConnection === native &&
				native.all === all &&
				native.run === run &&
				nativePin() &&
				this.transactionDepth === 1 &&
				this.isTransactionActive &&
				manager === this.manager &&
				manager.queryRunner === this &&
				manager.connection === source &&
				runnerPin() &&
				managerPin() &&
				broadcasterPin() &&
				ownerCurrent(),
		};
		scope.noMutation = evidence;
		const refuse = (): never => {
			evidence.decision = 'refused';
			throw new SqliteCommitGuardRefusedError(evidence.anomaly?.cause);
		};
		const clean = () => this.checkNoMutationPins(evidence) && !evidence.anomaly && evidence.mutations === 0n;
		if (!clean()) refuse();
		this.registerCommitGuard(manager, () => evidence.decision === 'applied' || evidence.decision === 'unchanged');
		const thisRunnerCurrent = () => this.checkNoMutationPins(evidence);
		let checkpoint: SqliteReadCheckpoint | undefined,
			reserved = false;
		return Object.freeze({
			async reserveZeroRows(table: string, column: string) {
				if (
					reserved ||
					checkpoint ||
					evidence.decision !== 'undecided' ||
					!/^[A-Za-z_][A-Za-z_0-9]*$/.test(table) ||
					!/^[A-Za-z_][A-Za-z_0-9]*$/.test(column) ||
					!clean()
				)
					refuse();
				reserved = true;
				const sql = `UPDATE "${table}" SET "${column}"="${column}" WHERE 0`;
				evidence.reservation = sql;
				try {
					await manager.query(sql);
				} finally {
					evidence.reservation = undefined;
				}
			},
			beginReads() {
				if (checkpoint || evidence.decision !== 'undecided' || evidence.pending.size || !clean()) refuse();
				checkpoint = Object.freeze({ kind: 'sqlite-read-checkpoint' });
				return checkpoint;
			},
			armUnchanged(candidate: SqliteReadCheckpoint) {
				if (
					!checkpoint ||
					candidate !== checkpoint ||
					evidence.decision !== 'undecided' ||
					evidence.pending.size ||
					!clean()
				)
					refuse();
				evidence.decision = 'unchanged';
			},
			applied() {
				if (evidence.decision !== 'undecided' || scope.phase !== 'open' || !scope.lease.active || !thisRunnerCurrent())
					refuse();
				evidence.decision = 'applied';
			},
			get outcome() {
				return receipt.outcome;
			},
		});
	}

	private checkNoMutationPins(evidence: NoMutationEvidence): boolean {
		try {
			if (evidence.current() === true) return true;
		} catch (cause: unknown) {
			evidence.anomaly ??= { cause };
		}
		evidence.anomaly ??= { cause: new Error('Original SQLite no-mutation identity expired') };
		return false;
	}

	private recordNoMutationAttempt(sql: string): NoMutationTicket | undefined {
		const scope = this.guardedCommit,
			evidence = scope?.noMutation;
		if (!evidence || scope.phase === 'committed' || scope.phase === 'settled') return undefined;
		const permit = this.noMutationControl;
		this.noMutationControl = undefined;
		const control = permit?.scope === scope && permit.sql === sql;
		const reservation = evidence.reservation === sql;
		evidence.reservation = undefined; // consumed BEFORE any await/reentry, even an invalid first call
		if (evidence.attempts === noMutationCounterLimit || evidence.mutations === noMutationCounterLimit)
			evidence.anomaly ??= { cause: new Error('SQLite query witness exhausted') };
		else {
			evidence.attempts++;
			if (!control && !reservation && !evidence.read(sql)) evidence.mutations++;
		}
		this.checkNoMutationPins(evidence);
		const ticket = { scope, sql, control, active: true, dispatched: false, retry: false };
		evidence.pending.add(ticket);
		return ticket;
	}

	private validateNoMutationDispatch(scope: GuardedCommit, ticket: NoMutationTicket | undefined, sql: string): void {
		const evidence = scope.noMutation;
		if (!evidence || scope.phase === 'committed' || scope.phase === 'settled') return;
		this.checkNoMutationPins(evidence);
		if (!ticket || !ticket.active || ticket.scope !== scope || ticket.sql !== sql || !evidence.pending.has(ticket))
			evidence.anomaly ??= { cause: new Error('SQLite native dispatch lacks its original query ticket') };
	}

	/** Only original outer control dispatch can mint a one-use exemption, after its Before callback. */
	private async noMutationOuterControl(commit: boolean): Promise<void> {
		await this.broadcaster.broadcast(commit ? 'BeforeTransactionCommit' : 'BeforeTransactionRollback');
		const sql = commit ? 'COMMIT' : 'ROLLBACK';
		this.noMutationControl = { scope: this.guardedCommit, sql };
		try {
			await this.query(sql);
		} finally {
			this.noMutationControl = undefined;
		}
		this.isTransactionActive = false;
		this.transactionDepth--;
		await this.broadcaster.broadcast(commit ? 'AfterTransactionCommit' : 'AfterTransactionRollback');
	}

	async startTransaction(isolationLevel?: IsolationLevel): Promise<void> {
		this.coordinator.assertAvailable();
		if (this.writeAdmission) {
			// Suppress only this managed attempt's TypeORM catch rollback, never a direct caller's rollback.
			this.coordinator.markFailedStart();
			return this.coordinator.track(() =>
				Promise.reject(
					new Error('SQLite write admission forbids reentrant transaction start before BEGIN acknowledgement'),
				),
			);
		}
		if (!this.lease?.active) this.lease = await this.coordinator.acquire(this);
		const previousDepth = this.transactionDepth;
		const writeIntent = this.writeIntentRequested && previousDepth === 0;
		this.writeIntentRequested = false;
		// Start subscribers already run on this lease: retain their failures before the body can attach guards.
		const outerScope: GuardedCommit | undefined =
			previousDepth === 0 ? { lease: this.lease, guards: [], phase: 'starting', outcome: 'pending' } : undefined;
		if (outerScope) this.guardedCommit = outerScope;
		try {
			await this.withTransactionControl(() =>
				writeIntent ? this.startWithWriteIntent() : super.startTransaction(isolationLevel),
			);
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
			if (writeIntent) this.writeAdmission = undefined;
			if (outerScope) this.settleCommitScope();
			this.releaseIfSettled();
		}
	}

	async transactionWithWriteIntent<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
		this.writeIntentRequested = true;
		try {
			return await this.withConnection(() => this.manager.transaction(callback));
		} finally {
			this.writeIntentRequested = false;
			this.writeAdmission = undefined;
			await this.release();
		}
	}

	private async startWithWriteIntent(): Promise<void> {
		this.writeAdmission = 'pending';
		this.isTransactionActive = true;
		try {
			await this.broadcaster.broadcast('BeforeTransactionStart');
			this.writeAdmission = 'armed';
			await this.query('BEGIN IMMEDIATE TRANSACTION');
		} finally {
			// Original query settlement, not an all-descendants AfterQuery receipt.
			this.writeAdmission = undefined;
		}
		this.transactionDepth += 1;
		await this.broadcaster.broadcast('AfterTransactionStart');
	}

	async commitTransaction(): Promise<void> {
		try {
			await this.coordinator.drainCurrent();
			await this.withTransactionControl(() =>
				this.guardedCommit?.noMutation && this.isTransactionActive && this.transactionDepth === 1
					? this.noMutationOuterControl(true)
					: super.commitTransaction(),
			);
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
			await this.withTransactionControl(() =>
				this.guardedCommit?.noMutation && this.isTransactionActive && this.transactionDepth === 1
					? this.noMutationOuterControl(false)
					: super.rollbackTransaction(),
			);
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

	/** Inert evidence for this OWN outer transaction. No guard, SQL, drain or permission is added. */
	observeOuterOutcome(manager: EntityManager): SqliteCommitGuardReceipt {
		const scope = this.guardedCommit;
		if (
			manager !== this.manager ||
			manager.queryRunner !== this ||
			!scope ||
			!this.isTransactionActive ||
			this.transactionDepth !== 1 ||
			scope.phase !== 'open'
		) {
			throw new Error('Native outcome observation requires its exact open outer manager');
		}
		scope.observed = true;
		return Object.freeze({
			get outcome() {
				return scope.outcome;
			},
		});
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
		const entryScope = this.guardedCommit;
		if (entryScope?.noMutation && entryScope.phase !== 'committed' && entryScope.phase !== 'settled') {
			const entryTicket = this.noMutationQuery.getStore();
			this.validateNoMutationDispatch(entryScope, entryTicket, entryTicket?.sql ?? '');
		}
		const connection = (await super.connect()) as NativeSqliteConnection;
		const commitScope = this.nativeCommitContext.getStore();
		const activeScope = this.guardedCommit;
		const window =
			activeScope?.noMutation && activeScope.phase !== 'committed' && activeScope.phase !== 'settled'
				? activeScope
				: undefined;
		const scope = commitScope ?? window;
		if (!scope) return connection;
		const ticket = this.noMutationQuery.getStore();
		if (window) this.validateNoMutationDispatch(window, ticket, ticket?.sql ?? '');
		const context = this.coordinator.captureCommitContext(scope.lease);
		const callbackContext = window ? AsyncLocalStorage.snapshot() : undefined;
		// The facade belongs to this original query ticket. Never modify the shared native object.
		return new Proxy(connection, {
			get: (target, property) => {
				if (property === 'all' || (window && property === 'run')) {
					return (query: string, parameters: unknown[], callback: NativeQueryCallback) => {
						if (window) {
							this.validateNoMutationDispatch(window, ticket, query);
							if (ticket) {
								if (ticket.dispatched && !ticket.retry)
									window.noMutation.anomaly ??= { cause: new Error('SQLite query ticket was already dispatched') };
								ticket.dispatched = true;
								ticket.retry = false;
							}
						}
						const originalCallback = callback;
						if (window)
							callback = function (error, rows) {
								// The original native callback owns the captured query ALS, including accepted
								// children issued by AfterQuery. BUSY retains this same context and ticket.
								callbackContext((receiver: unknown) => {
									if (ticket && error?.toString().includes('SQLITE_BUSY:')) ticket.retry = true;
									originalCallback.call(receiver, error, rows);
								}, this);
							};
						if (
							property !== 'all' ||
							query !== 'COMMIT' ||
							!commitScope ||
							(scope.guards.length === 0 && !scope.observed)
						) {
							const original = window ? window.noMutation[property] : target.all;
							return original.call(window?.noMutation.native ?? target, query, parameters, callback) as unknown;
						}
						if (scope.guards.length === 0) {
							// Observe the ORIGINAL guardless path. Do not seal or drain it as a guarded commit.
							scope.outcome = 'unknown';
							return target.all(query, parameters, function (error, rows) {
								if (!error) scope.outcome = 'committed';
								callback.call(this, error, rows);
							});
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
					const witness = scope.noMutation;
					if (witness && witness.decision !== 'applied') {
						this.checkNoMutationPins(witness);
						if (
							witness.decision !== 'unchanged' ||
							witness.anomaly ||
							witness.mutations !== 0n ||
							[...witness.pending].some((ticket) => !ticket.control)
						)
							throw new SqliteCommitGuardRefusedError(witness.anomaly?.cause);
					}
					scope.phase = 'submitted';
					scope.outcome = 'unknown';
					submitted = true;
					// UNKNOWN until an actual native acknowledgement; dispatch alone is never commit confirmation.
					// No await, subscriber, timer or recapture between the ORIGINAL pure guards and native dispatch.
					(scope.noMutation?.all ?? connection.all).call(
						connection,
						query,
						parameters,
						function (error: Error | null, rows?: unknown[]) {
							if (!error) {
								scope.phase = 'committed';
								scope.outcome = 'committed';
							} else if (error.toString().includes('SQLITE_BUSY:')) {
								scope.phase = 'sealed';
							} else {
								scope.outcome = 'unknown';
							}
							deliver.call(this, error, rows);
						},
					);
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
			if (this.guardedCommit?.outcome === 'pending') this.guardedCommit.outcome = 'unknown';
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

/** Private opt-in; no required public DataSource shape change. */
export function captureSqliteNoMutationWindow(
	manager: EntityManager,
	ownerCurrent: () => boolean,
): SqliteNoMutationWindow {
	if (!(manager.queryRunner instanceof CoordinatedSqliteQueryRunner))
		throw new Error('SQLite no-mutation window requires its coordinated scoped manager');
	return manager.queryRunner.captureNoMutationWindow(manager, ownerCurrent);
}

/** Read-only native ACK, never a write/COMMIT admission. A SAVEPOINT cannot manufacture outer completion. */
export function observeSqliteOuterOutcome(manager: EntityManager): SqliteCommitGuardReceipt {
	if (!(manager.queryRunner instanceof CoordinatedSqliteQueryRunner)) {
		throw new Error('Native outcome observation requires a coordinated scoped manager');
	}
	return manager.queryRunner.observeOuterOutcome(manager);
}

/** Read-only caller lease presence, including ordinary nontransactional queries. Not writer ownership. */
export function hasCurrentSqliteConnectionLease(dataSource: DataSource): boolean {
	return coordinators.get(dataSource)?.currentRunner !== undefined;
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
