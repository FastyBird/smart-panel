import {
	PROTECT_DEFAULT_RATE_POLICY,
	PROTECT_MAX_RETRY_AFTER_MS,
	PROTECT_RATE_UTILISATION,
} from '../devices-unifi-protect.constants';

export interface ProtectRatePolicy {
	quota: number;
	windowSeconds: number;
}

export interface ProtectRateState {
	remaining: number;
	resetSeconds: number;
}

export type ProtectHeaders = Record<string, string | string[] | undefined>;

type HeaderValue = string | string[] | undefined;

function items(header: HeaderValue): string[] {
	if (header === undefined) {
		return [];
	}

	const raw = Array.isArray(header) ? header.join(',') : header;

	return typeof raw === 'string'
		? raw
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
		: [];
}

function param(item: string, name: string): number | null {
	const match = new RegExp(`(?:^|;)\\s*${name}=(\\d+)\\s*(?:;|$)`).exec(item);

	const value = match ? Number(match[1]) : null;

	// A digit run long enough to become Infinity (or lose precision) is not a usable parameter.
	return value !== null && Number.isSafeInteger(value) ? value : null;
}

const rawIntervalMs = (policy: ProtectRatePolicy, utilisation: number): number =>
	Math.ceil((policy.windowSeconds * 1000) / Math.max(1, Math.floor(policy.quota * utilisation)));

/** Spacing between requests; clamped so that a hostile or odd advertised policy cannot stall the client for long. */
export function pacingIntervalMs(policy: ProtectRatePolicy, utilisation: number = PROTECT_RATE_UTILISATION): number {
	return Math.min(PROTECT_MAX_RETRY_AFTER_MS, rawIntervalMs(policy, utilisation));
}

export function parseRateLimitPolicy(header: HeaderValue): ProtectRatePolicy | null {
	let best: ProtectRatePolicy | null = null;

	for (const item of items(header)) {
		const quota = param(item, 'q');
		const windowSeconds = param(item, 'w');

		if (quota === null || windowSeconds === null || quota <= 0 || windowSeconds <= 0) {
			continue;
		}

		const candidate = { quota, windowSeconds };

		if (
			best === null ||
			rawIntervalMs(candidate, PROTECT_RATE_UTILISATION) > rawIntervalMs(best, PROTECT_RATE_UTILISATION)
		) {
			best = candidate;
		}
	}

	return best;
}

export function parseRateLimit(header: HeaderValue): ProtectRateState | null {
	let best: ProtectRateState | null = null;

	for (const item of items(header)) {
		const remaining = param(item, 'r');
		const resetSeconds = param(item, 't');

		if (remaining === null || resetSeconds === null) {
			continue;
		}

		// The fewest remaining wins; among equally exhausted limits the longest reset does, or the pause ends too early.
		if (
			best === null ||
			remaining < best.remaining ||
			(remaining === best.remaining && resetSeconds > best.resetSeconds)
		) {
			best = { remaining, resetSeconds };
		}
	}

	return best;
}

export function parseRetryAfterMs(header: HeaderValue, nowMs: number): number | null {
	const raw = Array.isArray(header) ? header[0] : header;

	if (typeof raw !== 'string') {
		return null;
	}

	const value = raw.trim();
	let ms: number;

	if (/^\d+$/.test(value)) {
		ms = Number(value) * 1000;
	} else if (/^[A-Za-z]{3},/.test(value)) {
		const date = Date.parse(value);

		if (Number.isNaN(date)) {
			return null;
		}

		ms = date - nowMs;
	} else {
		return null;
	}

	return Math.min(PROTECT_MAX_RETRY_AFTER_MS, Math.max(0, ms));
}

/** Abortable sleep whose timer is unref'd, so an idle waiter never keeps the process alive. */
export function protectSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason as Error);

			return;
		}

		const onAbort = (): void => {
			clearTimeout(timer);
			reject(signal?.reason as Error);
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		timer.unref();
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

/** Waits for the previous release turn, but gives up at once when the waiter is aborted. */
function waitForTurn(previous: Promise<void>, signal?: AbortSignal): Promise<void> {
	if (!signal) {
		return previous;
	}

	if (signal.aborted) {
		return Promise.reject(signal.reason as Error);
	}

	return new Promise((resolve, reject) => {
		const onAbort = (): void => reject(signal.reason as Error);

		signal.addEventListener('abort', onAbort, { once: true });
		void previous.then(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		});
	});
}

export class ProtectRatePacer {
	policy: ProtectRatePolicy = { ...PROTECT_DEFAULT_RATE_POLICY };

	private pausedUntil = 0;
	private lastReleasedAt = Number.NEGATIVE_INFINITY;
	private releaseTurn: Promise<void> = Promise.resolve();

	private readonly utilisation: number;
	private readonly now: () => number;
	private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

	constructor(
		options: {
			utilisation?: number;
			now?: () => number;
			sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
		} = {},
	) {
		this.utilisation = options.utilisation ?? PROTECT_RATE_UTILISATION;
		this.now = options.now ?? Date.now;
		this.sleep = options.sleep ?? protectSleep;
	}

	/**
	 * Waiters take turns in FIFO order. The waiter whose turn it is goes once a full interval has passed since the
	 * previous actual release and any pause has ended, re-checked after every sleep, because a timer can resume late and
	 * a pause can be announced while it waits. Only that waiter holds a timer, so nothing is reserved ahead: an aborted
	 * waiter leaves at once and costs the waiters behind it no time.
	 */
	async acquire(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) {
			throw signal.reason;
		}

		const previous = this.releaseTurn;
		let passTurn: () => void = () => undefined;

		this.releaseTurn = new Promise((resolve) => (passTurn = resolve));

		try {
			await waitForTurn(previous, signal);

			for (;;) {
				if (signal?.aborted) {
					throw signal.reason;
				}

				const wait =
					Math.max(this.lastReleasedAt + pacingIntervalMs(this.policy, this.utilisation), this.pausedUntil) -
					this.now();

				if (wait <= 0) {
					this.lastReleasedAt = this.now();

					return;
				}

				await this.sleep(wait, signal);
			}
		} finally {
			// The turn passes on only after the previous one, even when this waiter was aborted early, so nobody
			// behind it overtakes a release that is still in progress.
			void previous.then(passTurn);
		}
	}

	observe(headers: ProtectHeaders): void {
		const policy = parseRateLimitPolicy(headers['ratelimit-policy']);

		if (policy) {
			this.policy = policy;
		}

		const state = parseRateLimit(headers['ratelimit']);

		if (state && state.remaining === 0) {
			this.backOff(state.resetSeconds * 1000);
		}
	}

	backOff(ms: number): void {
		if (!Number.isFinite(ms) || ms <= 0) {
			return;
		}

		this.pausedUntil = Math.max(this.pausedUntil, this.now() + Math.min(ms, PROTECT_MAX_RETRY_AFTER_MS));
	}
}
