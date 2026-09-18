import { ShellyV1InputTrackerService } from './shelly-v1-input-tracker.service';

describe('ShellyV1InputTrackerService', () => {
	let tracker: ShellyV1InputTrackerService;

	beforeEach(() => {
		tracker = new ShellyV1InputTrackerService();
	});

	it('baselines stale status on first event tracking and suppresses occurrence', () => {
		const result = tracker.trackEvent('dev-1', 0, 5, 'S');

		expect(result.shouldPublish).toBe(false);
		expect(result.isReset).toBe(false);
		expect(result.resetGeneration).toBe(0);
		expect(tracker.getLastCounter('dev-1', 0)).toBe(5);
	});

	it('explicit baseline initializes counter without triggering event', () => {
		tracker.baseline('dev-1', 0, 10);
		expect(tracker.getLastCounter('dev-1', 0)).toBe(10);

		// Repeated read with same counter
		const result = tracker.trackEvent('dev-1', 0, 10, 'S');
		expect(result.shouldPublish).toBe(false);
	});

	it('suppresses repeated status reads of unchanged event_cnt', () => {
		tracker.baseline('dev-1', 0, 10);

		const res1 = tracker.trackEvent('dev-1', 0, 10, 'S');
		expect(res1.shouldPublish).toBe(false);

		const res2 = tracker.trackEvent('dev-1', 0, 10, 'S');
		expect(res2.shouldPublish).toBe(false);
	});

	it('publishes event on counter increment for single press and commits on demand', () => {
		tracker.baseline('dev-1', 0, 10);

		const result = tracker.trackEvent('dev-1', 0, 11, 'S');
		expect(result.shouldPublish).toBe(true);
		expect(result.isReset).toBe(false);
		expect(result.resetGeneration).toBe(0);
		// Prior to commit, lastCounter remains at 10
		expect(tracker.getLastCounter('dev-1', 0)).toBe(10);

		// Commit advances counter
		result.commit();
		expect(tracker.getLastCounter('dev-1', 0)).toBe(11);
	});

	it('allows retry when occurrence publication fails and commit is not called', () => {
		tracker.baseline('dev-1', 0, 10);

		// First attempt with counter 11 fails downstream
		const attempt1 = tracker.trackEvent('dev-1', 0, 11, 'S');
		expect(attempt1.shouldPublish).toBe(true);
		// commit() is NOT called (simulating downstream failure)
		expect(tracker.getLastCounter('dev-1', 0)).toBe(10);

		// Retry with same counter 11 should still publish
		const attempt2 = tracker.trackEvent('dev-1', 0, 11, 'S');
		expect(attempt2.shouldPublish).toBe(true);
		attempt2.commit();
		expect(tracker.getLastCounter('dev-1', 0)).toBe(11);

		// Subsequent call with counter 11 is now suppressed
		const attempt3 = tracker.trackEvent('dev-1', 0, 11, 'S');
		expect(attempt3.shouldPublish).toBe(false);
	});

	it('publishes consecutive identical events as counter increments and commits', () => {
		tracker.baseline('dev-1', 0, 1);

		// First press: S, counter 2
		const firstPress = tracker.trackEvent('dev-1', 0, 2, 'S');
		expect(firstPress.shouldPublish).toBe(true);
		firstPress.commit();

		// Second consecutive identical press: S, counter 3
		const secondPress = tracker.trackEvent('dev-1', 0, 3, 'S');
		expect(secondPress.shouldPublish).toBe(true);
		secondPress.commit();

		// Third consecutive identical press: S, counter 4
		const thirdPress = tracker.trackEvent('dev-1', 0, 4, 'S');
		expect(thirdPress.shouldPublish).toBe(true);
		thirdPress.commit();
		expect(tracker.getLastCounter('dev-1', 0)).toBe(4);
	});

	it('suppresses event if counter increments but rawEvent is empty string', () => {
		tracker.baseline('dev-1', 0, 1);

		const result = tracker.trackEvent('dev-1', 0, 2, '');
		expect(result.shouldPublish).toBe(false);
		expect(tracker.getLastCounter('dev-1', 0)).toBe(2);
	});

	it('handles counter reset to 0 on reboot without publishing', () => {
		tracker.baseline('dev-1', 0, 50);

		// Device power cycled, counter resets to 0 with empty event
		const result = tracker.trackEvent('dev-1', 0, 0, '');
		expect(result.shouldPublish).toBe(false);
		expect(result.isReset).toBe(true);
		expect(result.resetGeneration).toBe(1);
		expect(tracker.getLastCounter('dev-1', 0)).toBe(0);
	});

	it('handles counter reset to 1 with event on reboot and tracks reset generation', () => {
		tracker.baseline('dev-1', 0, 50);

		// Battery replaced and button immediately pressed -> counter resets to 1 with event 'S'
		const result = tracker.trackEvent('dev-1', 0, 1, 'S');
		expect(result.shouldPublish).toBe(true);
		expect(result.isReset).toBe(true);
		expect(result.resetGeneration).toBe(1);
		// Prior to commit
		expect(tracker.getLastCounter('dev-1', 0)).toBe(50);

		result.commit();
		expect(tracker.getLastCounter('dev-1', 0)).toBe(1);

		// Counter advances to 5
		const press5 = tracker.trackEvent('dev-1', 0, 5, 'S');
		press5.commit();
		expect(tracker.getLastCounter('dev-1', 0)).toBe(5);

		// Second reset after power cycle back to 1
		const result2 = tracker.trackEvent('dev-1', 0, 1, 'S');
		expect(result2.isReset).toBe(true);
		expect(result2.resetGeneration).toBe(2);
	});

	it('preserves state across deep sleep cycles for sleeping battery button', () => {
		// Button is paired and baselined at counter 10
		tracker.baseline('btn-1', 0, 10);

		// Button goes to sleep (offline)
		// When it wakes up and user clicked, RTC preserved counter increments to 11
		const wakePress = tracker.trackEvent('btn-1', 0, 11, 'SS');
		expect(wakePress.shouldPublish).toBe(true);
		wakePress.commit();
		expect(tracker.getLastCounter('btn-1', 0)).toBe(11);

		// Button goes to sleep again, wakes up and user clicked SSS, counter 12
		const secondWakePress = tracker.trackEvent('btn-1', 0, 12, 'SSS');
		expect(secondWakePress.shouldPublish).toBe(true);
		secondWakePress.commit();
		expect(tracker.getLastCounter('btn-1', 0)).toBe(12);
	});

	it('handles multi-channel devices independently (Shelly i3)', () => {
		tracker.baseline('i3-1', 0, 5);
		tracker.baseline('i3-1', 1, 10);
		tracker.baseline('i3-1', 2, 15);

		// Press channel 1
		const ch1 = tracker.trackEvent('i3-1', 1, 11, 'L');
		expect(ch1.shouldPublish).toBe(true);
		ch1.commit();

		// Unchanged channel 0
		const ch0 = tracker.trackEvent('i3-1', 0, 5, 'S');
		expect(ch0.shouldPublish).toBe(false);

		// Press channel 2
		const ch2 = tracker.trackEvent('i3-1', 2, 16, 'SS');
		expect(ch2.shouldPublish).toBe(true);
		ch2.commit();
	});

	it('clears device state on resetDevice', () => {
		tracker.baseline('dev-1', 0, 5);
		tracker.baseline('dev-2', 0, 10);

		tracker.resetDevice('dev-1');
		expect(tracker.getLastCounter('dev-1', 0)).toBeUndefined();
		expect(tracker.getLastCounter('dev-2', 0)).toBe(10);
	});
});
