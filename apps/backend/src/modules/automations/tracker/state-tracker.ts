/**
 * The automation state tracker: last-seen values, transition and threshold-crossing detection and "for"
 * durations for device properties.
 *
 * Framework-free (ADR 0003, decision 15): it must not import NestJS, TypeORM or anything else from the
 * application. Device events are fed in by an adapter (`AutomationStateTrackerService`), time comes from an
 * injected clock, so every rule can be tested with a fake clock.
 *
 * The rules (design § Trigger semantics, ADR 0003 decision 5):
 *
 * - A value is kept only for a property that is referenced by a watch or by `reference()`.
 * - A watch fires on a transition between two valid values, never on a repeated report.
 * - The first valid report of a property never seen before is not a transition.
 * - Edges are compared against the last valid value, so true → offline → true does not fire.
 * - A numeric watch fires on crossing its threshold, not while the value stays beyond it. With a hysteresis
 *   it fires again only after the value came back past the threshold by at least the hysteresis.
 * - A "for" duration belongs to the watch. It starts when the value enters the target state and is
 *   cancelled when the value leaves it, becomes invalid, or the device goes offline. It starts again only
 *   after a fresh valid report in the target state, and once it has fired it does not fire again until the
 *   value has really left the target state.
 * - When the target state already holds at the moment a "for" watch learns the value (on subscribing or
 *   when the baseline is seeded), the duration starts from that moment and the fire is marked `rearmed`.
 * - Seeding a baseline never fires.
 */
import { TrackerClock } from './clock';

export type TrackedValue = string | number | boolean;

export const STATE_WATCH_MODES = ['edge', 'level'] as const;

export type StateWatchMode = (typeof STATE_WATCH_MODES)[number];

/** The longest "for" duration a watch accepts: seven days, far below the limit of a timer */
export const STATE_WATCH_MAX_FOR_SECONDS = 7 * 24 * 60 * 60;

export interface StateWatchSpec {
	propertyId: string;
	/** Fire when the value becomes exactly this */
	to?: TrackedValue;
	/** Fire only when the value was exactly this before the change */
	from?: TrackedValue;
	/** Fire when a numeric value rises above this */
	above?: number;
	/** Fire when a numeric value falls below this */
	below?: number;
	/**
	 * How far the value has to come back past the threshold before the watch can fire again. Only with
	 * `above` or `below`; left out or 0 means every crossing fires.
	 */
	hysteresis?: number;
	/** Fire only after the target state (`to`, `above` or `below`) has held for this many seconds */
	forSeconds?: number;
	/**
	 * `edge` (default): fire on a change between two known valid values.
	 * `level`: fire when a fresh valid report puts the value in the target state while it was not known to
	 * be there, so unknown → target counts. Meant for "wait until"; the state at the moment of subscribing
	 * does not fire and is to be checked with `read()`.
	 */
	mode?: StateWatchMode;
}

export interface StateWatchProblem {
	/** The field of the spec the problem is about */
	field: keyof StateWatchSpec;
	reason: string;
}

export interface StateFireData {
	propertyId: string;
	/** The last valid value before the change; left out when there was none or for a "for" fire */
	from?: TrackedValue;
	to: TrackedValue;
	/** For a "for" watch: how long the target state had held, in milliseconds of the monotonic clock */
	heldForMs?: number;
	/**
	 * For a "for" watch: true when the duration did not start from an observed transition but from a state
	 * that already held when the watch first learnt the value (start-up, save, first report).
	 */
	rearmed?: boolean;
}

export type StateFireCallback = (data: StateFireData) => void;

export interface StateSnapshot {
	/** null means the property has no value */
	value: TrackedValue | null;
	/** Whether the value can be trusted; defaults to true, and is always false for a null value */
	valid?: boolean;
	/** Whether the device is reachable; left out leaves what is known untouched (reachable by default) */
	online?: boolean;
}

export interface StateAvailability {
	valid?: boolean;
	online?: boolean;
}

export type StateReadResult =
	| { status: 'ok'; value: TrackedValue }
	| { status: 'unknown' }
	| { status: 'invalid' | 'offline'; value: TrackedValue | null };

export interface StateTrackerHooks {
	/** A property got its first reference: the place to read its baseline and hand it to `seed()` */
	onTrack?(propertyId: string): void;
	/** The last reference to a property was released and its value was dropped */
	onUntrack?(propertyId: string): void;
	/** A fire callback or a hook threw; the tracker carries on */
	onError?(error: unknown, propertyId: string): void;
}

export class StateWatchSpecError extends Error {
	public constructor(public readonly problems: StateWatchProblem[]) {
		super(`The state watch is not valid: ${problems.map((problem) => problem.reason).join(' ')}`);
		this.name = 'StateWatchSpecError';
	}
}

interface Watch {
	spec: StateWatchSpec;
	fire: StateFireCallback;
	/** The value is in the target state, with the hysteresis taken into account. Survives an outage. */
	holding: boolean;
	/** `level` mode: the target state is confirmed by a valid report; reset by an outage */
	confirmed: boolean;
	timer?: unknown;
	/** "for": already fired for the current stay in the target state */
	fired: boolean;
}

interface Entry {
	refs: number;
	/** Something was reported or seeded */
	known: boolean;
	value: TrackedValue | null;
	valid: boolean;
	online: boolean;
	/** The reachability was reported or seeded, so a later seed must not overwrite it */
	onlineKnown: boolean;
	hasGood: boolean;
	lastGood: TrackedValue | undefined;
	watches: Set<Watch>;
}

const isTrackedValue = (value: unknown): value is TrackedValue =>
	typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && !Number.isNaN(value));

const isThreshold = (spec: StateWatchSpec): boolean => spec.above !== undefined || spec.below !== undefined;

/** Whether the spec names a state the value can be in (`to`, `above` or `below`) */
export const hasTargetState = (spec: StateWatchSpec): boolean => spec.to !== undefined || isThreshold(spec);

/**
 * Checks a watch spec and returns the reasons it is refused; an empty list accepts it. A trigger card uses
 * it to refuse a configuration on save, and `watch()` refuses the same specs by throwing.
 */
export const validateStateWatchSpec = (spec: StateWatchSpec): StateWatchProblem[] => {
	const problems: StateWatchProblem[] = [];

	if (typeof spec.propertyId !== 'string' || spec.propertyId === '') {
		problems.push({ field: 'propertyId', reason: 'A property must be chosen.' });
	}

	for (const field of ['to', 'from'] as const) {
		if (spec[field] !== undefined && !isTrackedValue(spec[field])) {
			problems.push({ field, reason: `"${field}" must be a text, a number or a yes/no value.` });
		}
	}

	for (const field of ['above', 'below'] as const) {
		if (spec[field] !== undefined && (typeof spec[field] !== 'number' || !Number.isFinite(spec[field]))) {
			problems.push({ field, reason: `"${field}" must be a number.` });
		}
	}

	if (spec.above !== undefined && spec.below !== undefined) {
		problems.push({ field: 'below', reason: '"above" and "below" can not be used together.' });
	}

	if (isThreshold(spec) && (spec.to !== undefined || spec.from !== undefined)) {
		problems.push({
			field: spec.to !== undefined ? 'to' : 'from',
			reason: '"above" and "below" can not be combined with "to" or "from".',
		});
	}

	if (spec.hysteresis !== undefined) {
		if (typeof spec.hysteresis !== 'number' || !Number.isFinite(spec.hysteresis) || spec.hysteresis < 0) {
			problems.push({ field: 'hysteresis', reason: 'The hysteresis must be a number that is not negative.' });
		} else if (!isThreshold(spec)) {
			problems.push({ field: 'hysteresis', reason: 'A hysteresis needs "above" or "below".' });
		}
	}

	if (spec.mode !== undefined && !STATE_WATCH_MODES.includes(spec.mode)) {
		problems.push({ field: 'mode', reason: `The mode must be one of ${STATE_WATCH_MODES.join(', ')}.` });
	}

	if (spec.forSeconds !== undefined) {
		if (
			typeof spec.forSeconds !== 'number' ||
			!Number.isFinite(spec.forSeconds) ||
			spec.forSeconds <= 0 ||
			spec.forSeconds > STATE_WATCH_MAX_FOR_SECONDS
		) {
			problems.push({
				field: 'forSeconds',
				reason: `The duration must be more than 0 and at most ${STATE_WATCH_MAX_FOR_SECONDS} seconds.`,
			});
		} else if (!hasTargetState(spec) || spec.from !== undefined) {
			// "for" measures how long a state has held, and "from" or "any change" name no state to hold
			problems.push({
				field: 'forSeconds',
				reason: 'A duration needs a target state ("to", "above" or "below") and can not be used with "from".',
			});
		}
	}

	if (spec.mode === 'level' && (!hasTargetState(spec) || spec.from !== undefined)) {
		problems.push({
			field: 'mode',
			reason: 'The level mode needs a target state ("to", "above" or "below") and can not be used with "from".',
		});
	}

	return problems;
};

/**
 * Whether `value` is in the target state of the spec, given whether it was there before. The previous
 * state matters only inside the hysteresis band of a threshold, where it is kept.
 */
export const holdsTargetState = (spec: StateWatchSpec, value: TrackedValue, wasHolding = false): boolean => {
	const hysteresis = spec.hysteresis ?? 0;

	if (spec.above !== undefined) {
		if (typeof value !== 'number') return false;
		if (value > spec.above) return true;

		return wasHolding && hysteresis > 0 && value > spec.above - hysteresis;
	}

	if (spec.below !== undefined) {
		if (typeof value !== 'number') return false;
		if (value < spec.below) return true;

		return wasHolding && hysteresis > 0 && value < spec.below + hysteresis;
	}

	return spec.to !== undefined && value === spec.to;
};

/** Whether a change between two valid values fires a `from` / `to` / any-change watch */
export const transitionFires = (spec: StateWatchSpec, previous: TrackedValue, next: TrackedValue): boolean => {
	if (previous === next) return false;
	if (spec.from !== undefined && previous !== spec.from) return false;
	if (spec.to !== undefined && next !== spec.to) return false;

	return true;
};

export class StateTracker {
	private readonly entries = new Map<string, Entry>();

	public constructor(
		private readonly clock: TrackerClock,
		private readonly hooks: StateTrackerHooks = {},
	) {}

	/** Number of properties a value is kept for */
	public trackedCount(): number {
		return this.entries.size;
	}

	/** Number of "for" durations currently running */
	public pendingTimers(): number {
		let count = 0;

		for (const entry of this.entries.values()) {
			for (const watch of entry.watches) {
				if (watch.timer !== undefined) count++;
			}
		}

		return count;
	}

	public isTracked(propertyId: string): boolean {
		return this.entries.has(propertyId);
	}

	/**
	 * Keeps a last-seen value for a property without watching it (for conditions). Returns the function
	 * that releases the reference.
	 */
	public reference(propertyId: string): () => void {
		const entry = this.acquire(propertyId);
		let released = false;

		return () => {
			if (released) return;

			released = true;
			this.release(propertyId, entry);
		};
	}

	/**
	 * Starts watching a property. Never fires from inside this call. Returns the function that stops the
	 * watch and cancels its running duration.
	 *
	 * @throws StateWatchSpecError when the spec is not valid
	 */
	public watch(spec: StateWatchSpec, fire: StateFireCallback): () => void {
		const problems = validateStateWatchSpec(spec);

		if (problems.length > 0) {
			throw new StateWatchSpecError(problems);
		}

		const entry = this.acquire(spec.propertyId);
		const watch: Watch = { spec: { ...spec }, fire, holding: false, confirmed: false, fired: false };

		entry.watches.add(watch);
		this.prime(entry, watch);

		let released = false;

		return () => {
			if (released) return;

			released = true;
			this.cancelTimer(watch);
			entry.watches.delete(watch);
			this.release(spec.propertyId, entry);
		};
	}

	public read(propertyId: string): StateReadResult {
		const entry = this.entries.get(propertyId);

		if (!entry || !entry.known) return { status: 'unknown' };
		if (!entry.online) return { status: 'offline', value: entry.value };
		if (!entry.valid || entry.value === null) return { status: 'invalid', value: entry.value };

		return { status: 'ok', value: entry.value };
	}

	/**
	 * Gives a tracked property its baseline without firing. A baseline never replaces a value that was
	 * already reported or seeded, and a property nobody references is ignored. A "for" watch whose target
	 * state holds in the baseline starts its duration now. Returns whether the value was taken.
	 */
	public seed(propertyId: string, snapshot: StateSnapshot): boolean {
		const entry = this.entries.get(propertyId);

		if (!entry) return false;

		if (snapshot.online !== undefined && !entry.onlineKnown) {
			entry.online = snapshot.online;
			entry.onlineKnown = true;
		}

		if (entry.known) {
			if (!this.usable(entry)) this.suspend(entry);

			return false;
		}

		this.store(entry, snapshot.value, snapshot.valid);

		if (this.usable(entry)) {
			entry.hasGood = true;
			entry.lastGood = entry.value ?? undefined;
		}

		for (const watch of entry.watches) {
			this.prime(entry, watch);
		}

		return true;
	}

	/** Feeds a reported value. A property nobody references is ignored. */
	public report(propertyId: string, snapshot: StateSnapshot): void {
		const entry = this.entries.get(propertyId);

		if (!entry) return;

		this.store(entry, snapshot.value, snapshot.valid);

		if (snapshot.online !== undefined) {
			entry.online = snapshot.online;
			entry.onlineKnown = true;
		}

		if (!this.usable(entry) || entry.value === null) {
			this.suspend(entry);

			return;
		}

		const value = entry.value;
		const hadGood = entry.hasGood;
		const previous = entry.lastGood;

		entry.hasGood = true;
		entry.lastGood = value;

		// Copy: a fire callback may add or remove watches
		for (const watch of [...entry.watches]) {
			if (!entry.watches.has(watch)) continue;

			const { spec } = watch;
			const wasHolding = watch.holding;
			const holding = holdsTargetState(spec, value, wasHolding);

			watch.holding = holding;

			if (spec.forSeconds !== undefined) {
				if (!holding) {
					// Really left the target state: the next stay is a new one
					this.cancelTimer(watch);
					watch.fired = false;
				} else if (watch.timer === undefined && !watch.fired) {
					this.startTimer(entry, watch, !hadGood);
				}
			} else if (spec.mode === 'level') {
				const wasConfirmed = watch.confirmed;

				watch.confirmed = holding;

				if (holding && !wasConfirmed) {
					this.emit(watch, { propertyId, ...(hadGood && previous !== undefined ? { from: previous } : {}), to: value });
				}
			} else if (!hadGood || previous === undefined) {
				// The first valid value ever seen is a baseline, not a transition
			} else if (isThreshold(spec)) {
				if (holding && !wasHolding) this.emit(watch, { propertyId, from: previous, to: value });
			} else if (transitionFires(spec, previous, value)) {
				this.emit(watch, { propertyId, from: previous, to: value });
			}
		}
	}

	/**
	 * Feeds a change of validity or reachability that carries no value. Losing either cancels the running
	 * durations of the property; getting them back alone restarts nothing, because it is not a fresh report.
	 */
	public setAvailability(propertyId: string, availability: StateAvailability): void {
		const entry = this.entries.get(propertyId);

		if (!entry) return;

		if (availability.valid !== undefined && entry.known) entry.valid = availability.valid && entry.value !== null;

		if (availability.online !== undefined) {
			entry.online = availability.online;
			entry.onlineKnown = true;
		}

		if (!this.usable(entry)) this.suspend(entry);
	}

	/** Cancels every running duration and drops every watch and value */
	public dispose(): void {
		for (const entry of this.entries.values()) {
			for (const watch of entry.watches) {
				this.cancelTimer(watch);
			}

			entry.watches.clear();
		}

		this.entries.clear();
	}

	private acquire(propertyId: string): Entry {
		let entry = this.entries.get(propertyId);

		if (!entry) {
			entry = {
				refs: 0,
				known: false,
				value: null,
				valid: false,
				online: true,
				onlineKnown: false,
				hasGood: false,
				lastGood: undefined,
				watches: new Set(),
			};

			this.entries.set(propertyId, entry);
			entry.refs++;
			this.callHook(propertyId, () => this.hooks.onTrack?.(propertyId));

			return entry;
		}

		entry.refs++;

		return entry;
	}

	private release(propertyId: string, entry: Entry): void {
		entry.refs--;

		if (entry.refs <= 0 && this.entries.get(propertyId) === entry) {
			this.entries.delete(propertyId);
			this.callHook(propertyId, () => this.hooks.onUntrack?.(propertyId));
		}
	}

	private store(entry: Entry, value: TrackedValue | null, valid: boolean | undefined): void {
		const acceptable = value !== null && isTrackedValue(value);

		entry.known = true;
		entry.value = acceptable ? value : null;
		entry.valid = acceptable && (valid ?? true);
	}

	private usable(entry: Entry): boolean {
		return entry.known && entry.valid && entry.online && entry.value !== null;
	}

	/**
	 * Brings a watch in line with what is known right now. Never fires. Whether the watch is in its target
	 * state is taken from the last valid value, even during an outage, so the same value coming back is not
	 * a crossing; a "for" duration starts only on a value that can be trusted now.
	 */
	private prime(entry: Entry, watch: Watch): void {
		if (!entry.hasGood || entry.lastGood === undefined) return;

		watch.holding = holdsTargetState(watch.spec, entry.lastGood, false);

		if (!this.usable(entry)) return;

		watch.confirmed = watch.holding;

		if (watch.spec.forSeconds !== undefined && watch.holding && watch.timer === undefined && !watch.fired) {
			this.startTimer(entry, watch, true);
		}
	}

	/**
	 * The value can not be trusted any more: running durations are cancelled. Whether a watch was in its
	 * target state and whether its duration already fired are kept, so that the same value coming back
	 * after the outage is neither a transition nor a reason to fire again.
	 */
	private suspend(entry: Entry): void {
		for (const watch of entry.watches) {
			this.cancelTimer(watch);
			watch.confirmed = false;
		}
	}

	private startTimer(entry: Entry, watch: Watch, rearmed: boolean): void {
		const startedAt = this.clock.now();
		const propertyId = watch.spec.propertyId;

		watch.timer = this.clock.setTimeout(
			() => {
				watch.timer = undefined;

				// Defensive: a duration is cancelled whenever the value stops being usable
				if (!entry.watches.has(watch) || !this.usable(entry) || entry.value === null) return;

				watch.fired = true;

				this.emit(watch, {
					propertyId,
					to: entry.value,
					heldForMs: this.clock.now() - startedAt,
					...(rearmed ? { rearmed: true } : {}),
				});
			},
			(watch.spec.forSeconds ?? 0) * 1000,
		);
	}

	private cancelTimer(watch: Watch): void {
		if (watch.timer !== undefined) {
			this.clock.clearTimeout(watch.timer);
			watch.timer = undefined;
		}
	}

	private emit(watch: Watch, data: StateFireData): void {
		this.callHook(data.propertyId, () => watch.fire(data));
	}

	private callHook(propertyId: string, call: () => void): void {
		try {
			call();
		} catch (error) {
			try {
				this.hooks.onError?.(error, propertyId);
			} catch {
				// A failing error hook must not stop the other watches
			}
		}
	}
}
