import { AsyncLocalStorage } from 'node:async_hooks';
import {
	DataSource,
	DataSourceOptions,
	EntityManager,
	QueryRunner,
	TransactionAlreadyStartedError,
	TransactionNotStartedError,
	TypeORMError,
} from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

interface ConnectionLease {
	runner: CoordinatedSqliteQueryRunner;
	active: boolean;
	release: () => void;
	aborted?: Error;
	closing?: FullAbort;
}

interface NestedTail {
	owner?: OperationContext;
	finished: boolean;
	waiters: Set<() => void>;
}
interface NestedAdmission {
	owner: OperationContext;
	invocation: OperationContext;
	previous?: NestedTail;
	tail: NestedTail;
	state: 'queued' | 'started' | 'refused' | 'finished';
	wake: () => void;
	gate: Promise<void>;
	refusal?: FullAbort;
}
interface FullAbort {
	scope: GuardedCommit;
	reason?: { cause: unknown };
	ready: Promise<void>;
	resolveReason: () => void;
}
interface TerminalQuery {
	closing: FullAbort;
	sql: string;
	context?: OperationContext;
	connected: boolean;
	dispatched: boolean;
	retry?: boolean;
}
interface OperationContext {
	lease: ConnectionLease;
	parent?: OperationContext;
	active: boolean;
	accepting: boolean;
	children: NestedTail;
	completion: Promise<void>;
	nested?: NestedAdmission;
	managed?: true;
	primary?: { cause: unknown };
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
	issuedBeforeCapture?: true;
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
	connected: boolean;
	dispatched: boolean;
	retry: boolean;
	cleanup: boolean;
	dispatchFailure?: (cause: unknown) => void;
}
interface NativeEnvelope {
	ticket: NoMutationTicket;
	context: OperationContext;
	submit: () => void;
	refuse: (cause: unknown) => void;
}
interface NoMutationEvidence {
	queue: NativeEnvelope[];
	inFlight?: NativeEnvelope;
	terminal?: { nativeCause: unknown; origin: NoMutationTicket; logical?: { cause: unknown } };
	blocked: Array<() => void>;
	physical: () => boolean;
	decision: 'undecided' | 'unchanged' | 'applied' | 'refused';
	attempts: bigint;
	mutations: bigint;
	anomaly?: { cause: unknown };
	pending: Set<NoMutationTicket>;
	reservation?: string;
	current: () => boolean;
	read: (sql: string) => boolean;
	native?: NativeSqliteConnection;
	all?: NativeSqliteConnection['all'];
	run?: NativeSqliteConnection['run'];
}
const noMutationCounterLimit = (1n << 64n) - 1n;

function isSqliteTransactionControl(sql: string): boolean {
	const command = sql.replace(/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, '');
	return /^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(command);
}

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
		if ((text === '-' && sql[offset] === '-') || (text === '/' && sql[offset] === '*')) return false;
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
			children: { finished: true, waiters: new Set() },
			completion: undefined,
			operations: new Map(),
		};
	}

	private runContext<T>(context: OperationContext, operation: () => Promise<T>): Promise<T> {
		let complete: () => void, fail: (cause: unknown) => void;
		context.completion = new Promise<void>((resolve, reject) => {
			complete = resolve;
			fail = reject;
		});
		void context.completion.catch(() => undefined);
		const recordFailure = context.lease.runner.captureOwnFailureRecorder(context.lease);
		this.contexts.add(context);
		const result = this.context.run(context, async () => {
			try {
				const value = await operation();
				await this.drainOperations(context, true, true);
				return value;
			} catch (error) {
				if (!context.nested?.refusal) {
					recordFailure?.(error);
					context.lease.runner.recordEarlyChildFailure(context.lease, error);
				}
				await this.drainOperations(context, false, true);
				throw error;
			} finally {
				context.active = false;
			}
		});
		const retire = () => {
			this.contexts.delete(context);
			if (context.lease.closing) context.lease.runner.releaseIfSettled();
		};
		void result.then(
			() => {
				complete();
				retire();
			},
			(cause: unknown) => {
				fail(cause);
				retire();
			},
		);
		return result;
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
		if (nested) child.nested = this.prepareNested(owner, child);
		const recordFailure = owner.lease.runner.captureChildFailureRecorder(owner.lease);
		const promise = this.runContext(child, nested ? () => this.runNested(operation, owner) : operation);
		owner.operations.set(promise, child);
		void promise.then(
			() => owner.operations.delete(promise),
			(cause: unknown) => {
				if (!child.nested?.refusal) recordFailure?.(cause);
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
	async drainCommitChildren(context: OperationContext, dispatch: () => void, propagateFailure = true): Promise<void> {
		let failure: { cause: unknown } | undefined;
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
				if (!ancestors.has(candidate)) children.add(candidate.completion);
				for (const [promise, child] of candidate.operations) {
					if (!ancestors.has(child)) children.add(promise);
				}
			}
			if (children.size === 0) {
				if (propagateFailure && failure) throw failure.cause;
				dispatch();
				return;
			}
			const results = await Promise.allSettled(children);
			const failed = results.find((result) => result.status === 'rejected');
			if (failed?.status === 'rejected') failure ??= { cause: failed.reason as unknown };
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
		context.managed = true;
		if (typeof callback === 'function') {
			wrappedArgs[callbackIndex] = function (this: unknown, ...callbackArgs: unknown[]) {
				// Manual starts inside the callback must never suppress its outer rollback.
				context.managedStart = false;
				context.failedStart = false;
				try {
					const result: unknown = Reflect.apply(callback, this, callbackArgs);
					if (result instanceof Promise)
						void Promise.prototype.then.call(result, undefined, (cause: unknown) => {
							context.primary ??= { cause };
						});
					return result;
				} catch (cause) {
					context.primary ??= { cause };
					throw cause;
				}
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

	managedPrimary(): { cause: unknown } | undefined {
		for (let context = this.context.getStore(); context; context = context.parent) {
			if (context.managed) return context.primary;
		}
	}

	recordManagedFailure(cause: unknown): void {
		for (let context = this.context.getStore(); context; context = context.parent) {
			if (context.managed) {
				context.primary ??= { cause };
				return;
			}
		}
	}

	hasContexts(lease: ConnectionLease): boolean {
		return [...this.contexts].some((context) => context.lease === lease);
	}

	refuseQueued(lease: ConnectionLease): void {
		for (const context of this.contexts) {
			const admission = context.nested;
			if (context.lease !== lease || admission?.state !== 'queued') continue;
			admission.state = 'refused';
			admission.refusal = lease.closing;
			admission.previous?.waiters.delete(admission.wake);
			admission.previous = undefined;
			admission.wake();
		}
	}

	async drainOwned(lease: ConnectionLease): Promise<void> {
		await this.drainCommitChildren(this.captureCommitContext(lease), () => undefined, false);
	}

	private prepareNested(owner: OperationContext, invocation: OperationContext): NestedAdmission {
		const previous = owner.children;
		let wake: () => void;
		const gate = new Promise<void>((resolve) => {
			wake = resolve;
		});
		const tail: NestedTail = { owner: invocation, finished: false, waiters: new Set() };
		const admission: NestedAdmission = { owner, invocation, previous, tail, state: 'queued', wake, gate };
		owner.children = tail;
		if (previous.finished) wake();
		else previous.waiters.add(wake);
		if (owner.lease.closing) {
			admission.state = 'refused';
			admission.refusal = owner.lease.closing;
			previous.waiters.delete(wake);
			admission.previous = undefined;
			wake();
		}
		return admission;
	}

	/** The original sibling queue; refusal detaches only this invocation's admission wait. */
	async runNested<T>(operation: () => Promise<T>, owner = this.context.getStore()): Promise<T> {
		if (!owner?.lease.active) return operation();
		const admission = this.context.getStore().nested;
		const { gate, wake, tail } = admission;
		try {
			await gate;
			if (owner.lease.closing) {
				admission.state = 'refused';
				admission.refusal = owner.lease.closing;
				await admission.refusal.ready;
				throw admission.refusal.reason.cause;
			}
			if (!owner.lease.active) throw new Error('Nested SQLite original lease expired');
			admission.state = 'started';
			return await this.run(owner.lease, operation);
		} finally {
			admission.previous?.waiters.delete(wake);
			admission.previous = undefined;
			admission.state = 'finished';
			tail.finished = true;
			for (const signal of tail.waiters) signal();
			tail.waiters.clear();
			tail.owner = undefined;
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
	private startupPermit?: string;
	private terminalControlPermit?: { scope: GuardedCommit; context: OperationContext; sql: string };
	private readonly terminalQuery = new AsyncLocalStorage<TerminalQuery | undefined>();
	private readonly startupQuery = new AsyncLocalStorage<{ connected: boolean }>();
	private writeIntentRequested = false;
	private writeAdmission?: 'pending' | 'armed';
	private readonly nativeCommitContext = new AsyncLocalStorage<GuardedCommit | undefined>();
	private readonly noMutationQuery = new AsyncLocalStorage<NoMutationTicket>();
	private noMutationControl?: { scope: GuardedCommit; sql: string; outer: boolean };

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
		const closing = this.lease?.closing;
		const permit = this.terminalControlPermit;
		this.terminalControlPermit = undefined;
		if (
			closing &&
			!(
				(query === 'ROLLBACK' || query === 'COMMIT') &&
				permit?.sql === query &&
				permit?.scope === closing.scope &&
				permit.context === this.coordinator.captureCommitContext(closing.scope.lease)
			)
		) {
			await closing.ready;
			throw closing.reason.cause;
		}
		const terminal: TerminalQuery | undefined = closing
			? { closing, sql: query, connected: false, dispatched: false }
			: undefined;
		const startup = this.startupPermit === query;
		this.startupPermit = undefined;
		if (this.guardedCommit && !this.guardedCommit.noMutation && !startup) this.guardedCommit.issuedBeforeCapture = true;
		const entryScope = this.guardedCommit;
		let ticket: NoMutationTicket | undefined;
		try {
			ticket = this.recordNoMutationAttempt(query);
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
			if ((scope?.guards.length || scope?.noMutation) && (scope.phase === 'sealed' || scope.phase === 'submitted')) {
				const cause = new Error('SQLite guarded COMMIT is sealed against new candidate queries');
				if (scope.noMutation) scope.noMutation.anomaly ??= { cause };
				throw cause;
			}
			const outerCommit = command === 'COMMIT' && this.transactionDepth === 1 ? scope : undefined;
			const invoke = () => {
				if (terminal) terminal.context = this.coordinator.captureCommitContext(terminal.closing.scope.lease);
				return this.terminalQuery.run(terminal, () =>
					this.nativeCommitContext.run(outerCommit, () => super.query(query, parameters, useStructuredResult)),
				);
			};
			// Keep the original nonparticipating path, including its promise/child settlement topology.
			if (!ticket)
				return this.coordinator.track(() =>
					this.withConnection(() => this.startupQuery.run({ connected: !startup }, invoke)),
				);
			return await this.coordinator.track(() =>
				this.withConnection(async () => {
					try {
						if (ticket.scope.noMutation.terminal && !ticket.cleanup && query !== 'COMMIT')
							return await this.blockedQuery(ticket);
						const failed = new Promise<never>((_resolve, reject) => {
							ticket.dispatchFailure = reject;
						});
						const original = this.noMutationQuery.run(ticket, () => invoke());
						return (await Promise.race([original, failed])) as unknown;
					} catch (cause: unknown) {
						this.captureQueryFailure(ticket, cause);
						throw cause;
					} finally {
						// Settle the original ticket INSIDE the tracked operation, before its promise is removed
						// from the coordinator. The caller's outer finally runs a later microtask.
						if (ticket) {
							ticket.active = false;
							ticket.sql = undefined;
							ticket.dispatchFailure = undefined;
							ticket.scope.noMutation?.pending.delete(ticket);
						}
					}
				}),
			);
		} catch (cause: unknown) {
			this.retainQueryRefusal(entryScope, cause);
			throw cause;
		} finally {
			if (ticket) {
				ticket.active = false;
				ticket.sql = undefined;
				ticket.dispatchFailure = undefined;
				ticket.scope.noMutation?.pending.delete(ticket);
			}
		}
	}

	captureNoMutationWindow(manager: EntityManager, ownerCurrent: () => boolean): SqliteNoMutationWindow {
		const receipt = this.observeOuterOutcome(manager); // FIRST, before any candidate state/read.
		const scope = this.guardedCommit;
		if (scope.noMutation) throw new Error('Original SQLite no-mutation window already exists');
		// Publish the nonremovable obligation BEFORE any pin capture or owner callback can throw.
		const evidence: NoMutationEvidence = {
			queue: [],
			blocked: [],
			physical: () => false,
			decision: 'undecided',
			attempts: 0n,
			mutations: 0n,
			pending: new Set(),
			current: () => false,
			read: () => false,
		};
		scope.noMutation = evidence;
		try {
			// Even a later guard/context/pin capture failure keeps original physical custody.
			// It may never supply an unchanged decision, but cleanup and in-transaction work
			// still use the captured native receiver rather than adopting one at dispatch.
			const source = this.connection,
				driver = this.driver;
			const native = driver.databaseConnection as NativeSqliteConnection;
			const all = native.all,
				run = native.run;
			Object.assign(evidence, {
				native,
				all,
				run,
				physical: () =>
					scope === this.guardedCommit &&
					scope.lease === this.lease &&
					scope.lease.active &&
					!this.coordinator.isClosed &&
					source.isInitialized &&
					this.connection === source &&
					this.driver === driver &&
					driver.databaseConnection === native &&
					native.all === all &&
					native.run === run &&
					manager === this.manager &&
					manager.queryRunner === this &&
					manager.connection === source,
			});
			if (scope.issuedBeforeCapture)
				throw new Error('SQLite no-mutation capture must precede candidate query/connect issuance');
			this.registerCommitGuard(manager, () => {
				if (evidence.decision !== 'applied' && evidence.decision !== 'unchanged')
					throw new SqliteCommitGuardRefusedError(evidence.anomaly?.cause);
				return true;
			});
			const context = this.coordinator.captureCommitContext(scope.lease);

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

			const nativePin = pin(native, ['all', 'run']);
			const tables = new Set(
				source.entityMetadatas.filter((meta) => meta.tableType !== 'view').map((meta) => meta.tableName),
			);
			Object.assign(evidence, {
				native,
				all,
				run,
				read: (sql: string) => isNoMutationRead(sql, tables),
				physical: () =>
					scope === this.guardedCommit &&
					scope.lease === this.lease &&
					scope.lease.active &&
					!this.coordinator.isClosed &&
					source.isInitialized &&
					this.connection === source &&
					this.driver === driver &&
					driver.databaseConnection === native &&
					nativePin() &&
					manager === this.manager &&
					manager.queryRunner === this &&
					manager.connection === source,
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
			});
			const refuse = (): never => {
				evidence.decision = 'refused';
				throw new SqliteCommitGuardRefusedError(evidence.anomaly?.cause);
			};
			const clean = () => this.checkNoMutationPins(evidence) && !evidence.anomaly && evidence.mutations === 0n;
			if (!clean()) refuse();
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
					if (
						evidence.decision !== 'undecided' ||
						scope.phase !== 'open' ||
						!scope.lease.active ||
						evidence.terminal !== undefined ||
						!thisRunnerCurrent()
					)
						refuse();
					evidence.decision = 'applied';
				},
				get outcome() {
					return receipt.outcome;
				},
			});
		} catch (cause: unknown) {
			evidence.decision = 'refused';
			evidence.anomaly ??= {
				cause: cause instanceof SqliteCommitGuardRefusedError ? cause.cause : cause,
			};
			throw cause;
		}
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
			if ((!control || !permit.outer) && !reservation && !evidence.read(sql)) evidence.mutations++;
		}
		this.checkNoMutationPins(evidence);
		if (isSqliteTransactionControl(sql) && !control) {
			const cause = new Error('SQLite transaction control requires its original internal invocation');
			evidence.anomaly ??= { cause };
			throw new SqliteCommitGuardRefusedError(cause);
		}
		const ticket = {
			scope,
			sql,
			control,
			cleanup: control && permit.outer && sql === 'ROLLBACK',
			active: true,
			connected: false,
			dispatched: false,
			retry: false,
		};
		evidence.pending.add(ticket);
		return ticket;
	}

	private retainQueryRefusal(scope: GuardedCommit | undefined, cause: unknown): void {
		if (
			scope?.noMutation &&
			scope === this.guardedCommit &&
			scope.phase !== 'committed' &&
			scope.phase !== 'settled' &&
			!scope.noMutation.terminal
		) {
			// Refusals precede tracking or the base driver's error wrapper. Preserve the first
			// actual failure even during pure guards, without replacing a native origin reservation.
			scope.childFailure ??= { cause };
		}
	}

	private nativeDispatchRefusal(scope: GuardedCommit, cause: unknown): SqliteCommitGuardRefusedError {
		scope.noMutation.anomaly ??= { cause };
		const refusal = new SqliteCommitGuardRefusedError(cause);
		this.retainQueryRefusal(scope, refusal);
		return refusal;
	}

	private validateNoMutationDispatch(
		scope: GuardedCommit,
		ticket: NoMutationTicket | undefined,
		sql: string,
	): SqliteCommitGuardRefusedError | undefined {
		const evidence = scope.noMutation;
		if (!evidence || scope.phase === 'committed' || scope.phase === 'settled') return;
		this.checkNoMutationPins(evidence);
		if (!ticket || !ticket.active || ticket.scope !== scope || ticket.sql !== sql || !evidence.pending.has(ticket))
			return this.nativeDispatchRefusal(scope, new Error('SQLite native dispatch lacks its original query ticket'));
	}

	private blockedQuery(ticket: NoMutationTicket): Promise<never> {
		const evidence = ticket.scope.noMutation;
		return new Promise((_resolve, reject) => {
			const finish = () =>
				reject(
					new SqliteCommitGuardRefusedError(
						ticket.scope.childFailure ? ticket.scope.childFailure.cause : evidence.terminal?.logical?.cause,
					),
				);
			if (evidence.terminal && !evidence.terminal.logical) evidence.blocked.push(finish);
			else finish();
		});
	}

	private beginFullAbort(scope: GuardedCommit | undefined, trigger?: { cause: unknown }): FullAbort | undefined {
		if (
			!scope ||
			scope !== this.guardedCommit ||
			!scope.lease.active ||
			(!scope.guards.length && !scope.noMutation) ||
			scope.phase === 'committed'
		)
			return;
		const lease = scope.lease;
		if (lease.closing) return lease.closing;
		let resolveReason: () => void;
		const ready = new Promise<void>((resolve) => {
			resolveReason = resolve;
		});
		const terminal = scope.noMutation?.terminal;
		let reason = this.coordinator.managedPrimary() ?? scope.childFailure ?? terminal?.logical;
		if (!reason && !terminal) reason = trigger;
		if (!reason && !terminal) {
			const cause = new Error('Queued nested SQLite transaction was refused because its owning transaction is closing');
			cause.name = 'SqliteNestedTransactionAbortedError';
			reason = { cause };
		}
		const closing: FullAbort = { scope, reason, ready, resolveReason };
		lease.closing = closing;
		this.coordinator.refuseQueued(lease);
		if (reason) resolveReason();
		return closing;
	}

	captureOwnFailureRecorder(lease: ConnectionLease): ((cause: unknown) => void) | undefined {
		const scope = this.guardedCommit;
		if (!scope || scope.lease !== lease) return;
		return (cause) => {
			if (
				scope === this.guardedCommit &&
				lease.active &&
				(scope.guards.length || scope.noMutation) &&
				scope.phase !== 'committed' &&
				scope.phase !== 'settled' &&
				!scope.noMutation?.terminal
			)
				scope.childFailure ??= { cause };
		};
	}

	recordEarlyChildFailure(lease: ConnectionLease, cause: unknown): void {
		const scope = this.guardedCommit;
		if (scope?.lease === lease && scope.noMutation && !scope.noMutation.terminal)
			this.captureChildFailureRecorder(lease)?.(cause);
	}

	private captureQueryFailure(ticket: NoMutationTicket, cause: unknown): void {
		const scope = ticket.scope,
			evidence = scope.noMutation;
		if (evidence.terminal?.origin === ticket && !evidence.terminal.logical) {
			evidence.terminal.logical = { cause };
			const closing = scope.lease.closing;
			if (closing?.scope === scope && !closing.reason) {
				closing.reason = { cause };
				closing.resolveReason();
			}
			scope.childFailure ??= { cause };
			for (const finish of evidence.blocked.splice(0)) finish();
			this.pumpNative(scope);
		} else if (!evidence.terminal) this.captureChildFailureRecorder(scope.lease)?.(cause);
	}

	private latchNativeFailure(ticket: NoMutationTicket, cause: unknown): void {
		ticket.scope.noMutation.terminal ??= { nativeCause: cause, origin: ticket };
		this.beginFullAbort(ticket.scope);
	}

	private pumpNative(scope: GuardedCommit): void {
		const evidence = scope.noMutation;
		if (evidence.inFlight || (evidence.terminal && !evidence.terminal.logical)) return;
		const envelope = evidence.queue.shift();
		if (!envelope) return;
		const ticket = envelope.ticket;
		let physical = false;
		try {
			physical = evidence.physical();
		} catch (cause: unknown) {
			evidence.anomaly ??= { cause };
		}
		if (
			(!ticket.cleanup && evidence.terminal) ||
			!ticket.active ||
			!evidence.pending.has(ticket) ||
			ticket.scope !== this.guardedCommit ||
			!scope.lease.active ||
			!envelope.context.active ||
			envelope.context.lease !== scope.lease ||
			!physical
		) {
			envelope.refuse(new SqliteCommitGuardRefusedError(scope.childFailure?.cause));
			queueMicrotask(() => this.pumpNative(scope));
			return;
		}
		evidence.inFlight = envelope;
		envelope.submit();
	}

	private submitNative(
		scope: GuardedCommit,
		ticket: NoMutationTicket,
		property: 'run' | 'all',
		query: string,
		parameters: unknown[],
		callback: NativeQueryCallback,
		callbackContext: ReturnType<typeof AsyncLocalStorage.snapshot>,
		context: OperationContext,
	): NativeSqliteConnection {
		const evidence = scope.noMutation,
			native = evidence.native;
		const original = evidence[property];
		let finished = false;
		const deliver = (receiver: unknown, args: [Error | null, unknown[]?], nativeCompletion = true) => {
			if (finished) return;
			finished = true;
			const error = args[0];
			if (error?.toString().includes('SQLITE_BUSY:')) ticket.retry = true;
			else if (error && nativeCompletion && !ticket.cleanup) this.latchNativeFailure(ticket, error);
			try {
				callbackContext(() => Reflect.apply(callback, receiver, args));
			} finally {
				if (evidence.inFlight === envelope) evidence.inFlight = undefined;
				queueMicrotask(() => this.pumpNative(scope));
			}
		};
		const envelope: NativeEnvelope = {
			ticket,
			context,
			refuse: (cause) => deliver(native, [cause as Error], false),
			submit: () => {
				try {
					original.call(native, query, parameters, function (this: unknown, ...args: [Error | null, unknown[]?]) {
						deliver(this, args);
					});
				} catch (cause: unknown) {
					if (finished) throw cause;
					finished = true;
					this.latchNativeFailure(ticket, cause);
					if (evidence.inFlight === envelope) evidence.inFlight = undefined;
					ticket.dispatchFailure(cause);
				}
			},
		};
		evidence.queue.push(envelope);
		this.pumpNative(scope);
		return native;
	}

	/** Only original transaction methods mint a consumed control ticket AFTER their Before callbacks. */
	private async noMutationTransactionControl(
		operation: 'start' | 'commit' | 'rollback',
		isolation?: IsolationLevel,
	): Promise<void> {
		if (operation === 'start') {
			if (this.driver.transactionSupport === 'none')
				throw new TypeORMError(`Transactions aren't supported by ${this.connection.driver.options.type}.`);
			if (this.isTransactionActive && this.driver.transactionSupport === 'simple')
				throw new TransactionAlreadyStartedError();
			if (isolation && isolation !== 'READ UNCOMMITTED' && isolation !== 'SERIALIZABLE')
				throw new TypeORMError('SQLite only supports SERIALIZABLE and READ UNCOMMITTED isolation');
			this.isTransactionActive = true;
			try {
				await this.broadcaster.broadcast('BeforeTransactionStart');
			} catch (error) {
				this.isTransactionActive = false;
				throw error;
			}
		} else {
			if (!this.isTransactionActive) throw new TransactionNotStartedError();
			await this.broadcaster.broadcast(
				operation === 'commit' ? 'BeforeTransactionCommit' : 'BeforeTransactionRollback',
			);
		}
		const terminalRollback = operation === 'rollback' && this.guardedCommit.noMutation?.terminal !== undefined;
		const abortNested = terminalRollback && this.transactionDepth > 1;
		const outer = operation !== 'start' && (this.transactionDepth === 1 || terminalRollback);
		const sql =
			operation === 'start'
				? `SAVEPOINT typeorm_${this.transactionDepth}`
				: outer
					? operation === 'commit'
						? 'COMMIT'
						: 'ROLLBACK'
					: `${operation === 'commit' ? 'RELEASE' : 'ROLLBACK TO'} SAVEPOINT typeorm_${this.transactionDepth - 1}`;
		if (outer && this.lease.closing) {
			if (operation === 'rollback') await this.coordinator.drainOwned(this.lease);
			this.terminalControlPermit = {
				scope: this.lease.closing.scope,
				context: this.coordinator.captureCommitContext(this.lease),
				sql,
			};
		}
		this.noMutationControl = { scope: this.guardedCommit, sql, outer };
		try {
			await this.query(sql);
		} finally {
			this.noMutationControl = undefined;
			this.terminalControlPermit = undefined;
		}
		if (outer) this.isTransactionActive = false;
		this.transactionDepth = terminalRollback ? 0 : this.transactionDepth + (operation === 'start' ? 1 : -1);
		try {
			await this.broadcaster.broadcast(
				operation === 'start'
					? 'AfterTransactionStart'
					: operation === 'commit'
						? 'AfterTransactionCommit'
						: 'AfterTransactionRollback',
			);
		} finally {
			if (abortNested && this.lease?.active)
				this.lease.aborted = new Error('Nested SQLite terminal failure aborted the owning transaction scope');
		}
	}

	async startTransaction(isolationLevel?: IsolationLevel): Promise<void> {
		if (this.lease?.active && this.lease.closing) {
			await this.lease.closing.ready;
			throw this.lease.closing.reason.cause;
		}
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
				writeIntent
					? this.startWithWriteIntent()
					: this.guardedCommit?.noMutation && previousDepth > 0
						? this.noMutationTransactionControl('start', isolationLevel)
						: this.startOriginalTransaction(isolationLevel),
			);
			if (outerScope) outerScope.phase = 'open';
		} catch (error) {
			this.coordinator.recordManagedFailure(error);
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

	private async startOriginalTransaction(isolation?: IsolationLevel): Promise<void> {
		if (this.transactionDepth !== 0) return super.startTransaction(isolation);
		if (this.driver.transactionSupport === 'none')
			throw new TypeORMError(`Transactions aren't supported by ${this.connection.driver.options.type}.`);
		if (this.isTransactionActive && this.driver.transactionSupport === 'simple')
			throw new TransactionAlreadyStartedError();
		if (isolation && isolation !== 'READ UNCOMMITTED' && isolation !== 'SERIALIZABLE')
			throw new TypeORMError('SQLite only supports SERIALIZABLE and READ UNCOMMITTED isolation');
		this.isTransactionActive = true;
		try {
			await this.broadcaster.broadcast('BeforeTransactionStart');
		} catch (cause) {
			this.isTransactionActive = false;
			throw cause;
		}
		if (isolation) {
			this.startupPermit = `PRAGMA read_uncommitted = ${isolation === 'READ UNCOMMITTED' ? 'true' : 'false'}`;
			await this.query(this.startupPermit);
		}
		this.startupPermit = 'BEGIN TRANSACTION';
		await this.query(this.startupPermit);
		this.transactionDepth += 1;
		await this.broadcaster.broadcast('AfterTransactionStart');
	}

	private async startWithWriteIntent(): Promise<void> {
		this.writeAdmission = 'pending';
		this.isTransactionActive = true;
		try {
			await this.broadcaster.broadcast('BeforeTransactionStart');
			this.writeAdmission = 'armed';
			this.startupPermit = 'BEGIN IMMEDIATE TRANSACTION';
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
				this.guardedCommit?.noMutation || this.lease.closing
					? this.noMutationTransactionControl('commit')
					: super.commitTransaction(),
			);
		} catch (cause) {
			this.coordinator.recordManagedFailure(cause);
			throw cause;
		} finally {
			this.settleCommitScope();
			this.releaseIfSettled();
		}
	}

	async rollbackTransaction(): Promise<void> {
		if (this.coordinator.consumeFailedStart()) return;
		const scope = this.guardedCommit;
		const full = this.transactionDepth === 1 || scope?.noMutation?.terminal !== undefined;
		if (full) this.beginFullAbort(scope);
		if (scope && this.transactionDepth === 1) scope.phase = 'rolling_back';
		try {
			await this.coordinator.drainCurrent(false);
			await this.withTransactionControl(async () => {
				if (this.lease.closing) await this.coordinator.drainOwned(this.lease);
				await (scope?.noMutation || this.lease.closing
					? this.noMutationTransactionControl('rollback')
					: super.rollbackTransaction());
				if (this.lease.closing) await this.coordinator.drainOwned(this.lease);
			});
		} catch (error) {
			if (this.lease?.active && this.isTransactionActive) await this.recoverTransaction({ cause: error });
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
				!scope.childFailure &&
				!scope.noMutation?.terminal
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
		const terminal = this.terminalQuery.getStore();
		const entryClosing = this.lease?.closing;
		const terminalConnect =
			entryClosing &&
			terminal?.closing === entryClosing &&
			!terminal.connected &&
			terminal.context === this.coordinator.captureCommitContext(entryClosing.scope.lease);
		if (entryClosing && !terminalConnect) {
			await entryClosing.ready;
			throw entryClosing.reason.cause;
		}
		if (terminalConnect) terminal.connected = true;
		const entryWindow =
			entryScope?.noMutation && entryScope.phase !== 'committed' && entryScope.phase !== 'settled'
				? entryScope
				: undefined;
		const startup = this.startupQuery.getStore();
		if (entryScope && !entryScope.noMutation) {
			if (!startup || startup.connected) entryScope.issuedBeforeCapture = true;
			else startup.connected = true;
		}
		const entryTicket = this.noMutationQuery.getStore();
		const originalConnect = entryTicket !== undefined && !entryTicket.connected;
		let entryRefusal: SqliteCommitGuardRefusedError | undefined;
		if (entryWindow) {
			entryRefusal = this.validateNoMutationDispatch(entryWindow, entryTicket, entryTicket?.sql ?? '');
			if (entryTicket) entryTicket.connected = true;
			if (!originalConnect)
				entryRefusal ??= this.nativeDispatchRefusal(
					entryWindow,
					new Error('SQLite query ticket cannot lend its native connection'),
				);
		}
		const connection = (await super.connect()) as NativeSqliteConnection;
		const commitScope = this.nativeCommitContext.getStore();
		const activeScope = this.guardedCommit;
		const window =
			entryWindow ??
			(activeScope?.noMutation && activeScope.phase !== 'committed' && activeScope.phase !== 'settled'
				? activeScope
				: undefined);
		// A guard can attach after this connection is obtained. Keep a passive facade for that
		// original outer scope; unguarded native calls still forward unchanged while it is open.
		const connectionScope = entryScope ?? activeScope;
		const scope = commitScope ?? window ?? connectionScope;
		const closing = scope?.lease.closing ?? this.lease?.closing;
		if (closing && (!terminalConnect || terminal.closing !== closing)) {
			await closing.ready;
			throw closing.reason.cause;
		}
		if (!scope) return connection;
		const ticket = this.noMutationQuery.getStore();
		if (window) entryRefusal ??= this.validateNoMutationDispatch(window, ticket, ticket?.sql ?? '');
		const context =
			commitScope || window || terminalConnect ? this.coordinator.captureCommitContext(scope.lease) : undefined;
		const callbackContext = window ? AsyncLocalStorage.snapshot() : undefined;
		// The facade belongs to this original query ticket. Never modify the shared native object.
		return new Proxy(connection, {
			get: (target, property) => {
				if (property === 'all' || ((window || connectionScope) && property === 'run')) {
					return (...args: Parameters<NativeSqliteConnection['all']>) => {
						const [query, parameters] = args;
						const last = args[args.length - 1];
						const callback: NativeQueryCallback | undefined = typeof last === 'function' ? last : undefined;
						const closing = scope.lease.closing;
						if (!window && closing) {
							if (
								!terminalConnect ||
								terminal.closing !== closing ||
								!scope.lease.active ||
								scope !== this.guardedCommit ||
								!terminal.context.active ||
								property !== 'all' ||
								terminal.sql !== query ||
								(!terminal.retry &&
									(terminal !== this.terminalQuery.getStore() ||
										terminal.dispatched ||
										terminal.context !== this.coordinator.captureCommitContext(scope.lease)))
							) {
								const refusal = new SqliteCommitGuardRefusedError(closing.reason?.cause);
								if (!callback) throw refusal;
								callback.call(target, refusal);
								return target;
							}
							terminal.dispatched = true;
							terminal.retry = false;
						}
						if (window) {
							const refusal = entryRefusal ?? this.validateNoMutationDispatch(window, ticket, query);
							if (
								refusal ||
								!originalConnect ||
								entryScope !== window ||
								entryTicket !== ticket ||
								!ticket?.active ||
								ticket.scope !== window ||
								ticket.sql !== query ||
								!window.noMutation.pending.has(ticket) ||
								(ticket.dispatched && !ticket.retry) ||
								(isSqliteTransactionControl(query) && !ticket.control)
							) {
								callback.call(
									target,
									refusal ??
										this.nativeDispatchRefusal(
											window,
											new Error('SQLite native dispatch lacks its original single-use ticket'),
										),
								);
								return target;
							}
							ticket.dispatched = true;
							ticket.retry = false;
							if (query !== 'COMMIT' || !commitScope)
								return this.submitNative(
									window,
									ticket,
									property,
									query,
									parameters,
									callback,
									callbackContext,
									context,
								);
						}

						if (
							property !== 'all' ||
							query !== 'COMMIT' ||
							!commitScope ||
							(scope.guards.length === 0 && !scope.observed && !scope.noMutation)
						) {
							const original = window ? (window.noMutation[property] ?? target[property]) : target[property];
							if (!window && closing && query === 'ROLLBACK')
								return target.all(query, parameters, function (error, rows) {
									// TypeORM owns this retry; retain only this original live cleanup capability.
									if (error?.toString().includes('SQLITE_BUSY:')) terminal.retry = true;
									callback.call(this, error, rows);
								});
							return original.apply(window?.noMutation.native ?? target, args) as unknown;
						}
						if (scope.guards.length === 0 && !scope.noMutation) {
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
		const ticket = this.noMutationQuery.getStore();
		const latchFailure = (cause: unknown) => this.latchNativeFailure(ticket, cause);
		const callbackContext = AsyncLocalStorage.snapshot();
		let delivered = false;
		const deliver: NativeQueryCallback = function (error, rows) {
			if (delivered) return;
			delivered = true;
			if (ticket) {
				if (error?.toString().includes('SQLITE_BUSY:')) ticket.retry = true;
				else if (error && scope.outcome === 'unknown') latchFailure(error);
			}
			callbackContext(() => {
				callback.call(this, error, rows);
			});
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
					// Preserve TypeORM's original pre-dispatch refusal envelope after closure. This
					// consumed control permit never authorizes a native COMMIT on a closing lease.
					if (scope.lease.closing)
						throw new SqliteCommitGuardRefusedError(
							scope.childFailure ? scope.childFailure.cause : scope.lease.closing.reason?.cause,
						);
					if (scope.noMutation?.inFlight || scope.noMutation?.queue.length || scope.noMutation?.terminal)
						throw new SqliteCommitGuardRefusedError(scope.childFailure?.cause);
					scope.phase = 'sealed';
					if (scope.childFailure) throw new SqliteCommitGuardRefusedError(scope.childFailure.cause);
					for (const guard of scope.guards) {
						if (guard() !== true) throw new SqliteCommitGuardRefusedError();
					}
					if (scope.childFailure) throw new SqliteCommitGuardRefusedError(scope.childFailure.cause);
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
						if (ticket) {
							this.latchNativeFailure(ticket, error);
							ticket.dispatchFailure(error);
							return;
						}
						deliver.call(
							connection,
							error instanceof Error ? error : new Error('Native COMMIT dispatch threw', { cause: error }),
						);
					} else {
						this.refuseCommit(scope, connection, deliver, error);
					}
				}
			})
			.catch((error: unknown) =>
				this.refuseCommit(scope, connection, deliver, scope.childFailure ? scope.childFailure.cause : error),
			);
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
		if (
			!scope ||
			(scope.lease.closing && this.coordinator.hasContexts(scope.lease)) ||
			this.isTransactionActive ||
			this.transactionDepth !== 0 ||
			scope.noMutation?.inFlight ||
			scope.noMutation?.queue.length ||
			scope.noMutation?.pending.size
		)
			return;
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

	releaseIfSettled(): void {
		if (this.lease?.closing) this.settleCommitScope();
		if (
			this.operationDepth === 0 &&
			(!this.lease?.closing || !this.coordinator.hasContexts(this.lease)) &&
			!this.isTransactionActive &&
			!this.guardedCommit?.noMutation?.inFlight &&
			!this.guardedCommit?.noMutation?.queue.length &&
			!this.guardedCommit?.noMutation?.pending.size
		)
			this.lease?.release();
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

	private async recoverTransaction(trigger?: { cause: unknown }): Promise<void> {
		const closing = this.beginFullAbort(this.guardedCommit, trigger);
		if (closing) return this.withTransactionControl(() => this.recoverOwnedTransaction(closing));
		return this.recoverOwnedTransaction();
	}

	private async recoverOwnedTransaction(closing?: FullAbort): Promise<void> {
		const hadTransaction = this.transactionDepth > 0;
		const abortedNestedTransaction = this.transactionDepth > 1;
		try {
			if (closing) await this.coordinator.drainOwned(closing.scope.lease);
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
		if (closing) await this.coordinator.drainOwned(closing.scope.lease);
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
