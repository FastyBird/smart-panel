import { AlarmState, ArmedState } from '../security.constants';

/**
 * The payload of `SecurityModule.State.Changed`: one transition of the armed state or of the alarm state.
 *
 * It is emitted only when the state differs from the one seen before, never for a recalculation that
 * found the same state, and never for the state found when the backend starts. `null` stands for "no
 * alarm reports one", e.g. when the last alarm device was removed.
 */
export type SecurityStateChangedPayload =
	| { kind: 'armed'; from: ArmedState | null; to: ArmedState | null }
	| { kind: 'alarm'; from: AlarmState | null; to: AlarmState | null };

export const SECURITY_STATE_KINDS = ['armed', 'alarm'] as const;

export type SecurityStateKind = (typeof SECURITY_STATE_KINDS)[number];
