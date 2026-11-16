import { PROTECT_COMMAND_MAX_WAITERS } from '../devices-unifi-protect.constants';

import { ProtectPatchField, protectFieldsMatch } from './protect-command';

type RawObject = Readonly<Record<string, unknown>>;

export interface ProtectConfirmationWaiter {
	/** True once an observation at/after the accepted point showed every field. */
	readonly matched: boolean;
	/** True when `cancelAll()` ended the waiter (session end); false for a timeout or dispose(). */
	readonly cancelled: boolean;
	/** Marks the PATCH as accepted (2xx) and evaluates the CURRENT cached device state first. Earlier observations never count. */
	accept(current: RawObject | null): void;
	/** Resolves true on a match (also one that happened before the call), false on timeout, cancelAll() or dispose(). */
	wait(timeoutMs: number): Promise<boolean>;
	dispose(): void;
}

class Waiter implements ProtectConfirmationWaiter {
	private accepted = false;
	private isMatched = false;
	private settled = false;
	private isCancelled = false;
	private promise: Promise<boolean> | null = null;
	private resolveWait: ((value: boolean) => void) | null = null;
	private timer: NodeJS.Timeout | null = null;

	constructor(
		private readonly fields: readonly ProtectPatchField[],
		private readonly release: (waiter: Waiter) => void,
	) {}

	get matched(): boolean {
		return this.isMatched;
	}

	get cancelled(): boolean {
		return this.isCancelled;
	}

	cancel(): void {
		if (!this.settled) {
			this.isCancelled = true;
		}

		this.finish(false);
	}

	accept(current: RawObject | null): void {
		if (this.settled || this.accepted) {
			return;
		}

		this.accepted = true;
		this.observe(current);
	}

	/** Called by the registry for each observation of this waiter's key; ignored until accept(). */
	observe(raw: RawObject | null): void {
		if (this.settled || !this.accepted || this.isMatched || !protectFieldsMatch(raw, this.fields)) {
			return;
		}

		this.isMatched = true;
		this.finish(true);
	}

	wait(timeoutMs: number): Promise<boolean> {
		if (this.promise !== null) {
			return this.promise;
		}

		this.promise = new Promise<boolean>((resolve) => {
			this.resolveWait = resolve;
		});

		if (this.settled) {
			this.resolveWait?.(this.isMatched);
		} else {
			this.timer = setTimeout(() => this.finish(false), Math.max(0, timeoutMs));
			this.timer.unref();
		}

		return this.promise;
	}

	/** Ends the wait; a waiter resolves once. */
	finish(value: boolean): void {
		if (this.settled) {
			return;
		}

		this.settled = true;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.resolveWait?.(value);
	}

	dispose(): void {
		this.finish(false);
		this.release(this);
	}
}

export class ProtectConfirmationWaiters {
	private readonly waiters = new Map<string, Set<Waiter>>();
	private count = 0;
	private readonly maxWaiters: number;

	constructor(options?: { maxWaiters?: number }) {
		this.maxWaiters = options?.maxWaiters ?? PROTECT_COMMAND_MAX_WAITERS;
	}

	/** Null when maxWaiters are armed. */
	arm(key: string, fields: readonly ProtectPatchField[]): ProtectConfirmationWaiter | null {
		if (this.count >= this.maxWaiters) {
			return null;
		}

		const waiter: Waiter = new Waiter(fields, (released) => this.remove(key, released));
		let set = this.waiters.get(key);

		if (!set) {
			set = new Set();
			this.waiters.set(key, set);
		}

		set.add(waiter);
		this.count++;

		return waiter;
	}

	observe(key: string, raw: RawObject): void {
		for (const waiter of [...(this.waiters.get(key) ?? [])]) {
			waiter.observe(raw);
		}
	}

	cancelAll(): void {
		const all = [...this.waiters.values()].flatMap((set) => [...set]);

		this.waiters.clear();
		this.count = 0;

		for (const waiter of all) {
			waiter.cancel();
		}
	}

	get size(): number {
		return this.count;
	}

	private remove(key: string, waiter: Waiter): void {
		const set = this.waiters.get(key);

		if (!set || !set.delete(waiter)) {
			return;
		}

		this.count--;

		if (set.size === 0) {
			this.waiters.delete(key);
		}
	}
}
