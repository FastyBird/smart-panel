import {
	PROTECT_RECONNECT_INITIAL_DELAY_MS,
	PROTECT_RECONNECT_JITTER_RATIO,
	PROTECT_RECONNECT_MAX_DELAY_MS,
} from '../devices-unifi-protect.constants';

/** Reconnect delay for a zero-based attempt: 1 s doubling to 60 s, with symmetric ±20 % jitter, capped at 60 s. */
export function calculateProtectReconnectDelay(attempt: number, randomValue: number = Math.random()): number {
	const normalizedAttempt = Number.isFinite(attempt)
		? Math.max(0, Math.floor(attempt))
		: attempt > 0
			? Number.MAX_SAFE_INTEGER
			: 0;
	const normalizedRandom = Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0.5;
	const exponentialDelay = Math.min(
		PROTECT_RECONNECT_INITIAL_DELAY_MS * 2 ** normalizedAttempt,
		PROTECT_RECONNECT_MAX_DELAY_MS,
	);
	const jitterFactor = 1 - PROTECT_RECONNECT_JITTER_RATIO + normalizedRandom * PROTECT_RECONNECT_JITTER_RATIO * 2;

	return Math.min(PROTECT_RECONNECT_MAX_DELAY_MS, Math.max(1, Math.round(exponentialDelay * jitterFactor)));
}
