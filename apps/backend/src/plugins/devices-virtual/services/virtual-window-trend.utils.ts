/** Window inference consumes qualified ambient evidence, never value history or a restored command. */
export interface VirtualWindowTrendPolicy {
	sampleWindowMs: number;
	minimumSamples: number;
	minimumSpanMs: number;
	maximumSampleAgeMs: number;
	slopeThresholdCPerMinute: number;
	confirmationMs: number;
	recoveryMs: number;
	maximumPauseMs: number;
	cooldownMs: number;
}
export interface VirtualWindowTrendFrame {
	temperature: number;
	sampledAt: number;
	/** Configuration/input/included-membership identity supplied by the qualified producer graph. */
	basis: string;
	quality: 'good' | 'degraded';
}
export interface VirtualWindowTrendState {
	frames: VirtualWindowTrendFrame[];
	direction: 'heating' | 'cooling' | 'off';
	basis: string | null;
	confirmationSince: number | null;
	recoverySince: number | null;
	pausedAt: number | null;
	pausedUntil: number | null;
	cooldownUntil: number | null;
	lastEvaluatedAt: number | null;
}
export interface VirtualWindowTrendInput {
	now: number;
	enabled: boolean;
	direction: 'heating' | 'cooling' | 'off';
	/** Undefined is a timer tick; null explicitly revokes ambient evidence. */
	frame?: VirtualWindowTrendFrame | null;
	/** Startup/remap/quality repair clears trend evidence while retaining a durable active hold. */
	rebaseline?: boolean;
}
export interface VirtualWindowTrendResult {
	state: VirtualWindowTrendState;
	paused: boolean;
	phase: 'disabled' | 'unavailable' | 'baseline' | 'monitoring' | 'confirming' | 'paused' | 'recovering' | 'cooldown';
	slopeCPerMinute: number | null;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function createVirtualWindowTrendState(): VirtualWindowTrendState {
	return {
		frames: [],
		direction: 'off',
		basis: null,
		confirmationSince: null,
		recoverySince: null,
		pausedAt: null,
		pausedUntil: null,
		cooldownUntil: null,
		lastEvaluatedAt: null,
	};
}
export function validateVirtualWindowTrendPolicy(policy: VirtualWindowTrendPolicy): boolean {
	if (!policy) return false;
	const durations = [
		policy.sampleWindowMs,
		policy.minimumSpanMs,
		policy.maximumSampleAgeMs,
		policy.confirmationMs,
		policy.recoveryMs,
		policy.maximumPauseMs,
		policy.cooldownMs,
	];
	return (
		durations.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 86_400_000) &&
		policy.sampleWindowMs > 0 &&
		policy.minimumSpanMs > 0 &&
		policy.minimumSpanMs <= policy.sampleWindowMs &&
		policy.maximumSampleAgeMs > 0 &&
		policy.maximumPauseMs > 0 &&
		Number.isInteger(policy.minimumSamples) &&
		policy.minimumSamples >= 3 &&
		policy.minimumSamples <= 2048 &&
		finite(policy.slopeThresholdCPerMinute) &&
		policy.slopeThresholdCPerMinute > 0
	);
}
function slope(frames: readonly VirtualWindowTrendFrame[]): number | null {
	const first = frames[0];
	const centerTime = frames.reduce((sum, frame) => sum + (frame.sampledAt - first.sampledAt) / frames.length, 0);
	const centerTemperature = frames.reduce(
		(sum, frame) => sum + (frame.temperature - first.temperature) / frames.length,
		0,
	);
	let numerator = 0,
		denominator = 0;
	for (const frame of frames) {
		const x = frame.sampledAt - first.sampledAt - centerTime;
		numerator += x * (frame.temperature - first.temperature - centerTemperature);
		denominator += x * x;
	}
	const result = (numerator / denominator) * 60_000;
	return denominator > 0 && finite(result) ? result : null;
}

/** Pure state transition. Runtime persists active holds and resets the baseline before accepting startup evidence. */
export function evaluateVirtualWindowTrend(
	policy: VirtualWindowTrendPolicy,
	previous: VirtualWindowTrendState,
	input: VirtualWindowTrendInput,
): VirtualWindowTrendResult {
	let state: VirtualWindowTrendState = { ...previous, frames: previous.frames.map((frame) => ({ ...frame })) };
	const result = (
		phase: VirtualWindowTrendResult['phase'],
		slopeCPerMinute: number | null = null,
	): VirtualWindowTrendResult => ({ state, paused: state.pausedUntil !== null, phase, slopeCPerMinute });
	if (!input.enabled) {
		state = createVirtualWindowTrendState();
		return result('disabled');
	}
	if (
		!validateVirtualWindowTrendPolicy(policy) ||
		!finite(input.now) ||
		(state.lastEvaluatedAt !== null && input.now < state.lastEvaluatedAt)
	)
		return result('unavailable');
	state.lastEvaluatedAt = input.now;
	const reset = () => {
		state.frames = [];
		state.basis = null;
		state.confirmationSince = null;
		state.recoverySince = null;
	};
	if (state.pausedAt !== null && state.pausedUntil !== null)
		state.pausedUntil = Math.min(state.pausedUntil, state.pausedAt + policy.maximumPauseMs);
	if (state.pausedUntil !== null && input.now >= state.pausedUntil) {
		state.pausedAt = null;
		state.pausedUntil = null;
		state.cooldownUntil = input.now + policy.cooldownMs;
		reset();
	}
	if (input.rebaseline || state.direction !== input.direction) reset();
	state.direction = input.direction;
	if (input.direction === 'off') {
		reset();
		return result(state.pausedUntil !== null ? 'paused' : 'baseline');
	}
	let newEvidence = false;
	if (input.frame === null) reset();
	else if (input.frame !== undefined) {
		const frame = input.frame;
		if (
			!finite(frame.temperature) ||
			!finite(frame.sampledAt) ||
			frame.sampledAt > input.now ||
			input.now - frame.sampledAt >= policy.maximumSampleAgeMs ||
			!frame.basis ||
			!['good', 'degraded'].includes(frame.quality)
		) {
			reset();
			return result('unavailable');
		}
		const basis = frame.basis + ':' + frame.quality;
		const last = state.frames.at(-1);
		if (
			state.basis !== basis ||
			(last &&
				(frame.sampledAt < last.sampledAt ||
					(frame.sampledAt === last.sampledAt && frame.temperature !== last.temperature)))
		)
			reset();
		state.basis = basis;
		if (!state.frames.length || frame.sampledAt > state.frames.at(-1).sampledAt) {
			state.frames.push({ ...frame });
			newEvidence = true;
		}
	}
	const last = state.frames.at(-1);
	if (!last || input.now - last.sampledAt >= policy.maximumSampleAgeMs) {
		reset();
		return result(state.pausedUntil !== null ? 'paused' : 'unavailable');
	}
	state.frames = state.frames.filter((frame) => frame.sampledAt >= last.sampledAt - policy.sampleWindowMs).slice(-2048);
	if (state.cooldownUntil !== null && input.now < state.cooldownUntil) return result('cooldown');
	state.cooldownUntil = null;
	if (
		state.frames.length < policy.minimumSamples ||
		last.sampledAt - state.frames[0].sampledAt < policy.minimumSpanMs
	) {
		state.confirmationSince = null;
		state.recoverySince = null;
		return result(state.pausedUntil !== null ? 'paused' : 'baseline');
	}
	const rate = slope(state.frames);
	if (rate === null) {
		reset();
		return result('unavailable');
	}
	const suspect =
		input.direction === 'heating' ? rate <= -policy.slopeThresholdCPerMinute : rate >= policy.slopeThresholdCPerMinute;
	if (state.pausedUntil !== null) {
		if (newEvidence) {
			if (suspect) state.recoverySince = null;
			else {
				state.recoverySince ??= input.now;
				if (input.now - state.recoverySince >= policy.recoveryMs) {
					state.pausedAt = null;
					state.pausedUntil = null;
					state.cooldownUntil = input.now + policy.cooldownMs;
					reset();
					return result('cooldown', rate);
				}
			}
		}
		return result(state.recoverySince !== null ? 'recovering' : 'paused', rate);
	}
	if (newEvidence) {
		if (!suspect) state.confirmationSince = null;
		else {
			state.confirmationSince ??= input.now;
			if (input.now - state.confirmationSince >= policy.confirmationMs) {
				state.pausedAt = input.now;
				state.pausedUntil = input.now + policy.maximumPauseMs;
				state.confirmationSince = null;
				state.recoverySince = null;
				return result('paused', rate);
			}
		}
	}
	return result(state.confirmationSince !== null ? 'confirming' : 'monitoring', rate);
}
