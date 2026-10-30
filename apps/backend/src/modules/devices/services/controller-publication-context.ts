import { AsyncLocalStorage } from 'node:async_hooks';

export interface ControllerEffectFact {
	readonly name: string;
	readonly submitted: boolean;
	readonly settled: boolean;
	readonly failed: boolean;
	readonly retired: boolean;
	readonly failure?: Readonly<{ cause: unknown }>;
}
interface Effect extends ControllerEffectFact {
	submitted: boolean;
	settled: boolean;
	failed: boolean;
	retired: boolean;
	failure?: Readonly<{ cause: unknown }>;
}
interface Scope {
	readonly owner: ControllerPublicationContext;
	accepting: boolean;
}
const scopes = new AsyncLocalStorage<Scope>();
const completionOwners = new AsyncLocalStorage<{
	accepting: boolean;
	publications: Set<ControllerPublicationContext>;
}>();

/** Finite original callback accounting. This is neither a storage transaction nor runtime authority. */
export class ControllerPublicationContext {
	private readonly effects: Effect[] = [];
	private readonly pending = new Set<Promise<void>>();
	private started = false;
	constructor(private readonly eligible: () => boolean) {}
	/** Enter before acquiring structure; original callbacks may need that owner to release before completion. */
	static async complete<T>(work: () => Promise<T>, ownCompletion = false): Promise<T> {
		// A standalone native/structural operation must settle its own callbacks even when
		// its caller's async continuation carries an unrelated outer completion owner.
		if (!ownCompletion && completionOwners.getStore()?.accepting) return work();
		const owner = { accepting: true, publications: new Set<ControllerPublicationContext>() };
		let result: T;
		let failure: { cause: unknown } | undefined;
		try {
			result = await completionOwners.run(owner, work);
		} catch (cause: unknown) {
			failure = { cause };
		}
		owner.accepting = false;
		await Promise.all([...owner.publications].map((publication) => publication.drain()));
		if (failure) throw failure.cause;
		return result;
	}
	private async drain(): Promise<void> {
		while (this.pending.size) await Promise.all([...this.pending]);
	}
	/** Retain only effect custody across an existing queue; its structural/native owner is supplied at execution. */
	static captureCallback<T>(work: () => T): () => T {
		const completion = completionOwners.getStore();
		const scope = scopes.getStore();
		return () => completionOwners.run(completion, () => scopes.run(scope, work));
	}
	/** Shared work receives its own finite owner; an earlier request must not lend it observation eligibility. */
	static independent<T>(work: () => T): T {
		return completionOwners.run(undefined, () => scopes.run(undefined, work));
	}
	static current(): ControllerPublicationContext | undefined {
		const scope = scopes.getStore();
		return scope?.accepting ? scope.owner : undefined;
	}
	isEligible(): boolean {
		try {
			return this.eligible() === true;
		} catch {
			return false;
		}
	}
	facts(): readonly ControllerEffectFact[] {
		return Object.freeze(this.effects.map((effect) => Object.freeze({ ...effect })));
	}
	async run<T>(work: () => Promise<T>): Promise<T> {
		if (this.started) throw new Error('Controller publication scope cannot be reused');
		this.started = true;
		const completion = completionOwners.getStore();
		const deferred = completion?.accepting === true;
		if (deferred) completion.publications.add(this);
		const scope: Scope = { owner: this, accepting: true };
		let result: T;
		let failure: { cause: unknown } | undefined;
		try {
			result = await scopes.run(scope, work);
		} catch (cause: unknown) {
			failure = { cause };
		}
		scope.accepting = false;
		// Only already enrolled finite callbacks can add their own original awaited effects.
		if (!deferred) await this.drain();
		if (failure) throw failure.cause;
		return result;
	}
	static effect<T>(name: string, work: () => Promise<T>): Promise<T> {
		const owner = ControllerPublicationContext.current();
		if (!owner) return work();
		const fact: Effect = { name, submitted: true, settled: false, failed: false, retired: !owner.isEligible() };
		owner.effects.push(fact);
		const scope: Scope = { owner, accepting: true };
		let original: Promise<T>;
		try {
			original = scopes.run(scope, work);
		} catch (cause: unknown) {
			scope.accepting = false;
			fact.settled = true;
			fact.failed = true;
			fact.failure = Object.freeze({ cause });
			throw cause;
		}
		const settled = original
			.then(
				() => {
					fact.settled = true;
				},
				(cause: unknown) => {
					fact.settled = true;
					fact.failed = true;
					fact.failure = Object.freeze({ cause });
				},
			)
			.then(() => {
				scope.accepting = false;
				fact.retired ||= !owner.isEligible();
				owner.pending.delete(settled);
			});
		owner.pending.add(settled);
		return original;
	}
}

/** Copy full point bytes; preserve unknown fields, nulls, Dates and binary values without normalization. */
export function ownControllerEffectValue<T>(value: T, seen = new Map<object, unknown>()): T {
	if (value === null || typeof value !== 'object') return value;
	if (seen.has(value)) return seen.get(value) as T;
	if (Buffer.isBuffer(value)) return Buffer.from(value) as T;
	if (value instanceof Date) return new Date(value.getTime()) as T;
	if (value instanceof ArrayBuffer) return value.slice(0) as T;
	if (ArrayBuffer.isView(value)) return structuredClone(value);
	const copy = (
		Array.isArray(value) ? new Array(value.length) : Object.create(Object.getPrototypeOf(value) as object | null)
	) as object;
	seen.set(value, copy);
	for (const key of Reflect.ownKeys(value)) {
		if (Array.isArray(value) && key === 'length') continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		Object.defineProperty(copy, key, {
			value: ownControllerEffectValue(Reflect.get(value, key) as unknown, seen),
			enumerable: descriptor.enumerable,
			writable: true,
			configurable: true,
		});
	}
	return copy as T;
}
