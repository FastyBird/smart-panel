import {
	HOMEY_RECONNECT_INITIAL_DELAY_MS,
	HOMEY_RECONNECT_JITTER_RATIO,
	HOMEY_RECONNECT_MAX_DELAY_MS,
} from '../devices-homey.constants';

/** Calculate a bounded full-generation reconnect delay with symmetric jitter. */
export function calculateHomeyReconnectDelay(attempt: number, randomValue: number = Math.random()): number {
	const normalizedAttempt = Number.isFinite(attempt)
		? Math.max(0, Math.floor(attempt))
		: attempt > 0
			? Number.MAX_SAFE_INTEGER
			: 0;
	const normalizedRandom = Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0.5;
	const exponentialDelay = Math.min(
		HOMEY_RECONNECT_INITIAL_DELAY_MS * 2 ** normalizedAttempt,
		HOMEY_RECONNECT_MAX_DELAY_MS,
	);
	const jitterFactor = 1 - HOMEY_RECONNECT_JITTER_RATIO + normalizedRandom * HOMEY_RECONNECT_JITTER_RATIO * 2;

	return Math.min(HOMEY_RECONNECT_MAX_DELAY_MS, Math.max(1, Math.round(exponentialDelay * jitterFactor)));
}
