import {
	VirtualWindowTrendPolicy,
	VirtualWindowTrendState,
	createVirtualWindowTrendState,
	evaluateVirtualWindowTrend,
	validateVirtualWindowTrendPolicy,
} from './virtual-window-trend.utils';

const policy: VirtualWindowTrendPolicy = {
	sampleWindowMs: 180_000,
	minimumSamples: 3,
	minimumSpanMs: 120_000,
	maximumSampleAgeMs: 120_000,
	slopeThresholdCPerMinute: 0.9,
	confirmationMs: 60_000,
	recoveryMs: 60_000,
	maximumPauseMs: 600_000,
	cooldownMs: 120_000,
};
const step = (
	state: VirtualWindowTrendState,
	time: number,
	temperature: number,
	direction: 'heating' | 'cooling' = 'heating',
	basis = 'room:1',
	overrides: Partial<VirtualWindowTrendPolicy> = {},
) =>
	evaluateVirtualWindowTrend({ ...policy, ...overrides }, state, {
		now: time,
		enabled: true,
		direction,
		frame: { temperature, sampledAt: time, basis, quality: 'good' },
	});
const trigger = (direction: 'heating' | 'cooling' = 'heating') => {
	let state = createVirtualWindowTrendState();
	for (let i = 0; i < 4; i++) state = step(state, i * 60_000, 20 + (direction === 'heating' ? -i : i), direction).state;
	return state;
};

describe('qualified ambient window trend', () => {
	it.each(['heating', 'cooling'] as const)(
		'confirms a sustained %s trend without any physical contact',
		(direction) => {
			const state = trigger(direction);
			expect(state.pausedAt).toBe(180_000);
			expect(state.pausedUntil).toBe(780_000);
		},
	);
	it.each(['heating', 'cooling'] as const)('does not infer %s windows from a reverse trend', (direction) => {
		let state = createVirtualWindowTrendState();
		for (let i = 0; i < 5; i++)
			state = step(state, i * 60_000, 20 + (direction === 'heating' ? i : -i), direction).state;
		expect(state.pausedUntil).toBeNull();
	});
	it('requires sample count, source-time span and new evidence across confirmation', () => {
		let state = step(createVirtualWindowTrendState(), 0, 20).state;
		state = step(state, 60_000, 19).state;
		expect(state.confirmationSince).toBeNull();
		state = step(state, 120_000, 18).state;
		expect(state.confirmationSince).toBe(120_000);
		const timer = evaluateVirtualWindowTrend(policy, state, { now: 180_000, enabled: true, direction: 'heating' });
		expect(timer.paused).toBe(false);
		expect(step(timer.state, 180_000, 17).paused).toBe(true);
	});
	it('does not count duplicate source clocks or temperature changes under the same clock', () => {
		let state = step(createVirtualWindowTrendState(), 0, 20).state;
		state = step(state, 0, 20).state;
		expect(state.frames).toHaveLength(1);
		state = step(state, 0, 19).state;
		expect(state.frames).toHaveLength(1);
		state = step(state, 60_000, 18).state;
		expect(state.confirmationSince).toBeNull();
	});
	it.each(['room:2', 'new-member-quorum'])('rebaselines input/config/member identity %s', (basis) => {
		let state = step(createVirtualWindowTrendState(), 0, 20).state;
		state = step(state, 60_000, 19).state;
		const next = step(state, 120_000, 5, 'heating', basis);
		expect(next.state.frames).toHaveLength(1);
		expect(next.paused).toBe(false);
	});
	it('resets trend evidence on aggregate quality changes, while retaining an active hold', () => {
		const previous = trigger();
		const result = evaluateVirtualWindowTrend(policy, previous, {
			now: 240_000,
			enabled: true,
			direction: 'heating',
			frame: { temperature: 25, sampledAt: 240_000, basis: 'room:1', quality: 'degraded' },
		});
		expect(result.state.frames).toHaveLength(1);
		expect(result.paused).toBe(true);
	});
	it('null, expiry and future evidence cannot infer closure or continue old confirmation', () => {
		let state = step(createVirtualWindowTrendState(), 0, 20).state;
		state = step(state, 60_000, 19).state;
		state = step(state, 120_000, 18).state;
		for (const frame of [null, { temperature: 17, sampledAt: 180_001, basis: 'room:1', quality: 'good' as const }]) {
			const result = evaluateVirtualWindowTrend(policy, state, {
				now: 180_000,
				enabled: true,
				direction: 'heating',
				frame,
			});
			expect(result.paused).toBe(false);
			expect(result.state.confirmationSince).toBeNull();
		}
		const expired = evaluateVirtualWindowTrend(policy, state, { now: 240_000, enabled: true, direction: 'heating' });
		expect(expired.phase).toBe('unavailable');
		expect(expired.state.frames).toEqual([]);
	});
	it('requires fresh recovery evidence, then applies cooldown', () => {
		let state = trigger();
		state = step(state, 240_000, 17).state;
		expect(state.recoverySince).toBe(240_000);
		const timer = evaluateVirtualWindowTrend(policy, state, { now: 300_000, enabled: true, direction: 'heating' });
		expect(timer.paused).toBe(true);
		const recovered = step(timer.state, 300_000, 17);
		expect(recovered.paused).toBe(false);
		expect(recovered.phase).toBe('cooldown');
		expect(step(recovered.state, 360_000, 5).phase).toBe('cooldown');
	});
	it('expires a maximum hold without claiming other floor/contact/user inhibits are cleared', () => {
		const result = evaluateVirtualWindowTrend(policy, trigger(), {
			now: 780_000,
			enabled: true,
			direction: 'heating',
			frame: null,
		});
		expect(result.paused).toBe(false);
		expect(result.state.frames).toEqual([]);
		expect(result.state.cooldownUntil).toBe(900_000);
	});
	it('restores only the active durable hold and builds a fresh startup baseline', () => {
		const persisted = trigger();
		const restored = {
			...createVirtualWindowTrendState(),
			pausedAt: persisted.pausedAt,
			pausedUntil: persisted.pausedUntil,
		};
		const next = step(restored, 240_000, 5);
		expect(next.paused).toBe(true);
		expect(next.state.frames).toHaveLength(1);
		expect(next.state.recoverySince).toBeNull();
	});
	it('shortening maximum pause cannot extend an old hold and changing direction cannot count an old trend', () => {
		const state = trigger();
		const next = step(state, 240_000, 26, 'cooling', 'room:1', { maximumPauseMs: 120_000 });
		expect(next.state.pausedUntil).toBe(300_000);
		expect(next.state.frames).toHaveLength(1);
		const extended = step(state, 240_000, 16, 'heating', 'room:1', { maximumPauseMs: 1_200_000 });
		expect(extended.state.pausedUntil).toBe(780_000);
	});
	it('explicit detector disable clears only its own hold, without restoring a command', () => {
		const result = evaluateVirtualWindowTrend(policy, trigger(), {
			now: 240_000,
			enabled: false,
			direction: 'heating',
		});
		expect(result).toMatchObject({ paused: false, phase: 'disabled' });
		expect(result.state.frames).toEqual([]);
		expect(result).not.toHaveProperty('command');
	});
	it('preserves a hold on clock rollback and never fabricates trend from nonfinite computations', () => {
		const state = trigger();
		expect(
			evaluateVirtualWindowTrend(policy, state, { now: 179_999, enabled: true, direction: 'heating' }),
		).toMatchObject({ paused: true, phase: 'unavailable' });
		let huge = step(createVirtualWindowTrendState(), 0, Number.MAX_VALUE).state;
		huge = step(huge, 60_000, 0).state;
		const result = step(huge, 120_000, -Number.MAX_VALUE);
		expect(result.paused).toBe(false);
		expect(result.slopeCPerMinute).toBeNull();
	});
	it.each([
		{ minimumSamples: 2 },
		{ minimumSpanMs: 180_001 },
		{ slopeThresholdCPerMinute: 0 },
		{ confirmationMs: -1 },
		{ maximumPauseMs: 0 },
		{ sampleWindowMs: Infinity },
	])('rejects invalid policy %j', (changes) => {
		expect(validateVirtualWindowTrendPolicy({ ...policy, ...changes })).toBe(false);
	});
});
