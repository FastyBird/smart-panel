import { PROTECT_FAILURE_LOG_INTERVAL_MS } from '../devices-unifi-protect.constants';

import { ProtectFailureLogLimiter } from './protect-failure-log-limiter';

describe('ProtectFailureLogLimiter', () => {
	it('logs once per key and interval and reports the suppressed count afterwards', () => {
		const limiter = new ProtectFailureLogLimiter();

		expect(limiter.consume('a', 0)).toEqual({ log: true, suppressed: 0 });
		expect(limiter.consume('a', 1)).toEqual({ log: false, suppressed: 1 });
		expect(limiter.consume('a', 2)).toEqual({ log: false, suppressed: 2 });
		expect(limiter.consume('b', 2)).toEqual({ log: true, suppressed: 0 });
		expect(limiter.consume('a', PROTECT_FAILURE_LOG_INTERVAL_MS)).toEqual({ log: true, suppressed: 2 });
		expect(limiter.consume('a', PROTECT_FAILURE_LOG_INTERVAL_MS + 1)).toEqual({ log: false, suppressed: 1 });
	});

	it('forgets everything on reset', () => {
		const limiter = new ProtectFailureLogLimiter();

		limiter.consume('a', 0);
		limiter.consume('a', 1);
		limiter.reset();

		expect(limiter.consume('a', 2)).toEqual({ log: true, suppressed: 0 });
	});

	it('tracks a bounded number of keys', () => {
		const limiter = new ProtectFailureLogLimiter();

		for (let index = 0; index < 100; index++) {
			limiter.consume(`key${index}`, 0);
		}

		expect((limiter as unknown as { failures: Map<string, unknown> }).failures.size).toBe(32);
	});
});
