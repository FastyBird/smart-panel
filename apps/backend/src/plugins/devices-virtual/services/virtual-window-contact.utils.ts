export type VirtualWindowContactValue = 'open' | 'closed' | 'unknown';
export interface VirtualWindowContactState {
	confirmed: VirtualWindowContactValue;
	candidate: 'open' | 'closed' | null;
	candidateSince: number | null;
	basis: string | null;
	lastEvaluatedAt: number | null;
}
export const createVirtualWindowContactState = (): VirtualWindowContactState => ({
	confirmed: 'unknown',
	candidate: null,
	candidateSince: null,
	basis: null,
	lastEvaluatedAt: null,
});
/** Runtime supplies explicitly mapped, qualified fresh contact evidence; missing evidence is never closed. */
export function evaluateVirtualWindowContact(
	previous: VirtualWindowContactState,
	policy: { openingMs: number; closingMs: number },
	input: { now: number; basis: string; reported: 'open' | 'closed' | null },
): VirtualWindowContactState {
	const state = { ...previous };
	const durations = [policy.openingMs, policy.closingMs];
	if (
		!Number.isFinite(input.now) ||
		!input.basis ||
		!durations.every((duration) => Number.isSafeInteger(duration) && duration >= 0 && duration <= 86_400_000) ||
		(previous.lastEvaluatedAt !== null && input.now < previous.lastEvaluatedAt)
	) {
		return { ...createVirtualWindowContactState(), lastEvaluatedAt: Number.isFinite(input.now) ? input.now : null };
	}
	state.lastEvaluatedAt = input.now;
	if (state.basis !== input.basis) {
		state.confirmed = 'unknown';
		state.candidate = null;
		state.candidateSince = null;
		state.basis = input.basis;
	}
	if (input.reported === null) {
		state.confirmed = 'unknown';
		state.candidate = null;
		state.candidateSince = null;
		return state;
	}
	if (state.confirmed === input.reported) {
		state.candidate = null;
		state.candidateSince = null;
		return state;
	}
	if (state.candidate !== input.reported || state.candidateSince === null) {
		state.candidate = input.reported;
		state.candidateSince = input.now;
	}
	const delay = input.reported === 'open' ? policy.openingMs : policy.closingMs;
	if (input.now - state.candidateSince >= delay) {
		state.confirmed = input.reported;
		state.candidate = null;
		state.candidateSince = null;
	}
	return state;
}
