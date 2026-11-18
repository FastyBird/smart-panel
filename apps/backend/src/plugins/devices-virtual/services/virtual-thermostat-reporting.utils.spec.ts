import { recommendedMaximumAgeSeconds } from './virtual-thermostat-reporting.utils';

describe('recommendedMaximumAgeSeconds', () => {
	it('leaves room for one late report, rounded up to whole minutes', () => {
		// A battery sensor with an hourly heartbeat: 60 min + 30 min.
		expect(recommendedMaximumAgeSeconds(3_600_000)).toBe(5_400);
		// 55 min 10 s * 1.5 = 82 min 45 s, rounded up to 83 min.
		expect(recommendedMaximumAgeSeconds(3_310_000)).toBe(4_980);
	});

	it('keeps the recommendation within 60 s and 24 h', () => {
		expect(recommendedMaximumAgeSeconds(10_000)).toBe(60);
		expect(recommendedMaximumAgeSeconds(20 * 3_600_000)).toBe(86_400);
	});

	it('gives no recommendation for an invalid interval', () => {
		expect(recommendedMaximumAgeSeconds(0)).toBeNull();
		expect(recommendedMaximumAgeSeconds(Number.NaN)).toBeNull();
	});
});
