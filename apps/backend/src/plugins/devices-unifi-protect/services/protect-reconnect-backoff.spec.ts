import { calculateProtectReconnectDelay } from './protect-reconnect-backoff';

describe('calculateProtectReconnectDelay', () => {
	it('doubles from 1 s and caps at 60 s', () => {
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((attempt) => calculateProtectReconnectDelay(attempt, 0.5))).toEqual([
			1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
		]);
	});

	it('applies ±20 % jitter and never exceeds the cap', () => {
		expect(calculateProtectReconnectDelay(0, 0)).toBe(800);
		expect(calculateProtectReconnectDelay(0, 1)).toBe(1200);
		expect(calculateProtectReconnectDelay(10, 1)).toBe(60000);
		expect(calculateProtectReconnectDelay(10, 0)).toBe(48000);
	});

	it('treats invalid input as the first attempt with no jitter', () => {
		expect(calculateProtectReconnectDelay(-3, 0.5)).toBe(1000);
		expect(calculateProtectReconnectDelay(Number.NaN, 0.5)).toBe(1000);
		expect(calculateProtectReconnectDelay(Number.POSITIVE_INFINITY, 0.5)).toBe(60000);
		expect(calculateProtectReconnectDelay(0, Number.NaN)).toBe(1000);
		expect(calculateProtectReconnectDelay(0, 7)).toBe(1200);
	});
});
