import type { ICamera } from '../store';

export interface ICameraProfilesTableProps {
	camera: ICamera;
}

const KNOWN_REASONS: ReadonlySet<string> = new Set([
	'stream_not_enabled',
	'camera_offline',
	'console_unavailable',
	'stream_state_unknown',
	'stream_tls_unverified',
]);

/** The locale key of the sentence for a provider's unavailable reason code; the raw code is never shown. */
export const cameraReasonSentenceKey = (code: string | null): string =>
	`camerasModule.reasons.${code !== null && KNOWN_REASONS.has(code) ? code : 'unknown'}`;
