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

	return match ? Number(match[1]) : null;
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

		if (best === null || remaining < best.remaining) {
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

export class ProtectRatePacer {
	policy: ProtectRatePolicy = { ...PROTECT_DEFAULT_RATE_POLICY };

	private nextSlotAt = 0;
	private pausedUntil = 0;

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

	async acquire(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) {
			throw signal.reason;
		}

		for (;;) {
			const now = this.now();
			const pausedAtReservation = this.pausedUntil;
			const slot = Math.max(now, this.nextSlotAt, pausedAtReservation);

			this.nextSlotAt = slot + pacingIntervalMs(this.policy, this.utilisation);

			if (slot > now) {
				await this.sleep(slot - now, signal);
			}

			// Only a longer pause announced while this waiter slept, and still running, pushes it to a new slot behind
			// the earlier waiters; a timer that merely woke early must not reorder the queue, and a newer pause that
			// has already ended must not make the waiter queue again.
			if (this.pausedUntil <= pausedAtReservation || this.now() >= this.pausedUntil) {
				return;
			}
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
