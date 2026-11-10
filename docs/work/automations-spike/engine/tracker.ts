// State tracker: last-seen values, transition / crossing detection, "for" timers. Framework-free.

export interface Clock {
	/** wall clock, epoch ms — only for time-of-day logic and trace timestamps */
	wallNow(): number;
	/** monotonic ms — for durations, rate windows */
	monoNow(): number;
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
	wallNow: () => Date.now(),
	// The prototype reads Date for both so that node:test mock timers drive it. Production must use a
	// monotonic source here (process.hrtime / performance.now).
	monoNow: () => Date.now(),
	setTimeout: (fn, ms) => setTimeout(fn, ms),
	clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
};

// Stand-ins for DevicesModule.ChannelProperty.ValueSet / .Updated / .ValueStateChanged
export const CH_VALUE_SET = 'value_set';
export const CH_PROPERTY_UPDATED = 'property_updated';
export const CH_STATE_CHANGED = 'value_state_changed';

export interface PropertyEvent {
	propertyId: string;
	value?: unknown;
	valid?: boolean;
	online?: boolean;
}

export class FakeBus {
	private readonly listeners = new Map<string, ((ev: PropertyEvent) => void)[]>();

	on(channel: string, fn: (ev: PropertyEvent) => void): void {
		if (!this.listeners.has(channel)) this.listeners.set(channel, []);
		this.listeners.get(channel)!.push(fn);
	}

	emit(channel: string, ev: PropertyEvent): void {
		for (const fn of this.listeners.get(channel) ?? []) fn(ev);
	}

	listenerCount(channel: string): number {
		return this.listeners.get(channel)?.length ?? 0;
	}
}

export interface WatchSpec {
	propertyId: string;
	to?: unknown;
	from?: unknown;
	above?: number;
	below?: number;
	forSeconds?: number;
	/**
	 * 'edge' (default): fire on a change between two known valid values.
	 * 'level': fire when a fresh valid report makes the predicate true while it was not known to be true
	 * (used by wait-until, where unknown → true must count).
	 */
	mode?: 'edge' | 'level';
}

export interface FireData {
	propertyId: string;
	from?: unknown;
	to: unknown;
	heldForMs?: number;
}

export type ReadResult =
	| { status: 'ok'; value: unknown }
	| { status: 'unknown' | 'invalid' | 'offline'; value?: unknown };

interface Watch {
	spec: WatchSpec;
	fire: (data: FireData) => void;
	timer?: unknown;
	timerStartedAt?: number;
	/** "for" already fired for the current stay in the target state */
	fired: boolean;
	/** level mode: predicate known to hold */
	holding: boolean;
}

interface Entry {
	refs: number;
	known: boolean;
	value: unknown;
	valid: boolean;
	online: boolean;
	hasGood: boolean;
	lastGood: unknown;
	watches: Set<Watch>;
}

export type Snapshot = Record<string, { value: unknown; valid?: boolean; online?: boolean }>;

/** Level predicate: is `value` in the watch's target state? Undefined if the spec has no level meaning. */
export function holds(spec: WatchSpec, value: unknown): boolean {
	if (spec.above !== undefined) return typeof value === 'number' && value > spec.above;
	if (spec.below !== undefined) return typeof value === 'number' && value < spec.below;
	if ('to' in spec && spec.to !== undefined) return value === spec.to;
	return false;
}

/** Edge predicate between two known valid values. */
export function transitionFires(spec: WatchSpec, prev: unknown, next: unknown): boolean {
	if (spec.above !== undefined || spec.below !== undefined) return !holds(spec, prev) && holds(spec, next);
	if (prev === next) return false;
	if (spec.from !== undefined && prev !== spec.from) return false;
	if (spec.to !== undefined && next !== spec.to) return false;
	return true;
}

export class StateTracker {
	private readonly props = new Map<string, Entry>();
	private readonly clock: Clock;
	private readonly lookup?: (propertyId: string) => Snapshot[string] | undefined;

	constructor(bus: FakeBus, clock: Clock = systemClock, lookup?: (propertyId: string) => Snapshot[string] | undefined) {
		this.clock = clock;
		this.lookup = lookup;
		// Exactly one listener per channel, routed by property id.
		bus.on(CH_VALUE_SET, (ev) => this.onReport(ev));
		bus.on(CH_PROPERTY_UPDATED, (ev) => this.onReport(ev));
		bus.on(CH_STATE_CHANGED, (ev) => this.onStateChanged(ev));
	}

	trackedCount(): number {
		return this.props.size;
	}

	pendingTimers(): number {
		let n = 0;
		for (const e of this.props.values()) for (const w of e.watches) if (w.timer !== undefined) n++;
		return n;
	}

	/** Seed last-seen values without firing. Only referenced properties are stored. */
	seed(snapshot: Snapshot): void {
		for (const [id, s] of Object.entries(snapshot)) {
			const e = this.props.get(id);
			if (!e) continue;
			this.applySeed(e, s);
			for (const w of e.watches) this.primeWatch(e, w);
		}
	}

	/** Keep a last-seen value for a property (conditions). Returns the release function. */
	reference(propertyId: string): () => void {
		const e = this.acquire(propertyId);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.release(propertyId, e);
		};
	}

	watch(spec: WatchSpec, fire: (data: FireData) => void): () => void {
		const e = this.acquire(spec.propertyId);
		const w: Watch = { spec, fire, fired: false, holding: false };
		e.watches.add(w);
		this.primeWatch(e, w);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.cancelTimer(w);
			e.watches.delete(w);
			this.release(spec.propertyId, e);
		};
	}

	read(propertyId: string): ReadResult {
		const e = this.props.get(propertyId);
		if (!e || !e.known) return { status: 'unknown' };
		if (!e.online) return { status: 'offline', value: e.value };
		if (!e.valid) return { status: 'invalid', value: e.value };
		return { status: 'ok', value: e.value };
	}

	private acquire(propertyId: string): Entry {
		let e = this.props.get(propertyId);
		if (!e) {
			e = { refs: 0, known: false, value: undefined, valid: false, online: true, hasGood: false, lastGood: undefined, watches: new Set() };
			this.props.set(propertyId, e);
			const s = this.lookup?.(propertyId);
			if (s) this.applySeed(e, s);
		}
		e.refs++;
		return e;
	}

	private release(propertyId: string, e: Entry): void {
		if (--e.refs <= 0) this.props.delete(propertyId);
	}

	private applySeed(e: Entry, s: Snapshot[string]): void {
		e.known = true;
		e.value = s.value;
		e.valid = s.valid ?? true;
		e.online = s.online ?? true;
		if (e.valid && e.online) {
			e.hasGood = true;
			e.lastGood = s.value;
		}
	}

	private usable(e: Entry): boolean {
		return e.known && e.valid && e.online;
	}

	/** Called on registration and on seed: never fires; starts a "for" timer if the state already holds. */
	private primeWatch(e: Entry, w: Watch): void {
		const level = this.usable(e) && holds(w.spec, e.value);
		w.holding = level;
		if (w.spec.forSeconds && level && w.timer === undefined && !w.fired) this.startTimer(e, w);
	}

	private onReport(ev: PropertyEvent): void {
		const e = this.props.get(ev.propertyId);
		if (!e) return; // not referenced by any enabled automation
		if (!('value' in ev)) return this.onStateChanged(ev);
		e.known = true;
		e.value = ev.value;
		e.valid = ev.valid ?? true;
		if (ev.online !== undefined) e.online = ev.online;
		const usable = this.usable(e);
		const prevGood = e.lastGood;
		const hadGood = e.hasGood;
		if (usable) {
			e.hasGood = true;
			e.lastGood = ev.value;
		}
		// Copy: a fire callback may add or remove watches.
		for (const w of [...e.watches]) {
			if (!e.watches.has(w)) continue;
			const level = usable && holds(w.spec, e.value);
			if (w.spec.forSeconds) {
				if (level) {
					if (w.timer === undefined && !w.fired) this.startTimer(e, w);
				} else {
					this.cancelTimer(w);
					if (usable) w.fired = false; // really left the target state
				}
			} else if (w.spec.mode === 'level') {
				const was = w.holding;
				w.holding = level;
				if (level && !was) w.fire({ propertyId: ev.propertyId, from: hadGood ? prevGood : undefined, to: e.value });
			} else if (usable && hadGood && transitionFires(w.spec, prevGood, e.value)) {
				w.fire({ propertyId: ev.propertyId, from: prevGood, to: e.value });
			}
		}
	}

	private onStateChanged(ev: PropertyEvent): void {
		const e = this.props.get(ev.propertyId);
		if (!e) return;
		if (ev.valid !== undefined) e.valid = ev.valid;
		if (ev.online !== undefined) e.online = ev.online;
		if (this.usable(e)) return; // coming back online alone is not a fresh report: nothing restarts
		for (const w of e.watches) {
			this.cancelTimer(w);
			w.holding = false;
		}
	}

	private startTimer(e: Entry, w: Watch): void {
		const startedAt = this.clock.monoNow();
		w.timerStartedAt = startedAt;
		w.timer = this.clock.setTimeout(
			() => {
				w.timer = undefined;
				w.fired = true;
				w.fire({ propertyId: w.spec.propertyId, to: e.value, heldForMs: this.clock.monoNow() - startedAt });
			},
			(w.spec.forSeconds ?? 0) * 1000,
		);
	}

	private cancelTimer(w: Watch): void {
		if (w.timer !== undefined) {
			this.clock.clearTimeout(w.timer);
			w.timer = undefined;
		}
	}
}
