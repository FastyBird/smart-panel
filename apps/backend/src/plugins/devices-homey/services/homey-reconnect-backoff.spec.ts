import { HOMEY_RECONNECT_INITIAL_DELAY_MS, HOMEY_RECONNECT_MAX_DELAY_MS } from '../devices-homey.constants';

import { calculateHomeyReconnectDelay } from './homey-reconnect-backoff';

describe('calculateHomeyReconnectDelay', () => {
	it('doubles the neutral-jitter delay for each attempt', () => {
		expect(calculateHomeyReconnectDelay(0, 0.5)).toBe(HOMEY_RECONNECT_INITIAL_DELAY_MS);
		expect(calculateHomeyReconnectDelay(1, 0.5)).toBe(HOMEY_RECONNECT_INITIAL_DELAY_MS * 2);
		expect(calculateHomeyReconnectDelay(2, 0.5)).toBe(HOMEY_RECONNECT_INITIAL_DELAY_MS * 4);
	});

	it('applies bounded symmetric jitter', () => {
		expect(calculateHomeyReconnectDelay(0, 0)).toBe(800);
		expect(calculateHomeyReconnectDelay(0, 1)).toBe(1200);
		expect(calculateHomeyReconnectDelay(0, -10)).toBe(800);
		expect(calculateHomeyReconnectDelay(0, 10)).toBe(1200);
	});

	it('caps large and invalid attempts at the maximum delay', () => {
		expect(calculateHomeyReconnectDelay(100, 1)).toBe(HOMEY_RECONNECT_MAX_DELAY_MS);
		expect(calculateHomeyReconnectDelay(Number.POSITIVE_INFINITY, 0.5)).toBe(HOMEY_RECONNECT_MAX_DELAY_MS);
		expect(calculateHomeyReconnectDelay(-1, 0.5)).toBe(HOMEY_RECONNECT_INITIAL_DELAY_MS);
		expect(calculateHomeyReconnectDelay(Number.NaN, Number.NaN)).toBe(HOMEY_RECONNECT_INITIAL_DELAY_MS);
	});
});
