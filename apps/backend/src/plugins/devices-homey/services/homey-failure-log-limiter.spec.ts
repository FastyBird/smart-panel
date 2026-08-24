import { HOMEY_FAILURE_LOG_INTERVAL_MS } from '../devices-homey.constants';

import { HomeyFailureLogLimiter } from './homey-failure-log-limiter';

describe('HomeyFailureLogLimiter', () => {
	it('logs the first failure and reports suppressed repetitions at the next bounded interval', () => {
		const limiter = new HomeyFailureLogLimiter();

		expect(limiter.consume('command', 1000)).toEqual({ log: true, suppressed: 0 });
		expect(limiter.consume('command', 1001)).toEqual({ log: false, suppressed: 1 });
		expect(limiter.consume('command', 1002)).toEqual({ log: false, suppressed: 2 });
		expect(limiter.consume('reconciliation', 1002)).toEqual({ log: true, suppressed: 0 });
		expect(limiter.consume('command', 1000 + HOMEY_FAILURE_LOG_INTERVAL_MS)).toEqual({
			log: true,
			suppressed: 2,
		});
	});

	it('forgets previous failures when runtime state resets', () => {
		const limiter = new HomeyFailureLogLimiter();

		limiter.consume('command', 1000);
		limiter.consume('command', 1001);
		limiter.reset();

		expect(limiter.consume('command', 1002)).toEqual({ log: true, suppressed: 0 });
	});
});
