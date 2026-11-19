import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
} from '../../../modules/cameras/cameras.exceptions';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectStreamOperation, toCameraProviderError } from './protect-stream-errors';

describe('toCameraProviderError', () => {
	it.each([
		['unavailable', 'source', CameraOfflineException],
		['not_found', 'snapshot', CameraOfflineException],
		['rate_limited', 'snapshot', CameraRateLimitedException],
		['rate_limited', 'source', CameraRateLimitedException],
		['timeout', 'source', CameraUpstreamException],
		['tls_fingerprint_mismatch', 'bridge', CameraProfileUnavailableException],
		['tls_untrusted', 'bridge', CameraProfileUnavailableException],
		['unavailable', 'bridge', CameraUpstreamException],
		['not_found', 'bridge', CameraUpstreamException],
		['unreachable', 'bridge', CameraUpstreamException],
		['unsupported', 'snapshot', CameraUpstreamException],
		['cancelled', 'source', CameraUpstreamException],
		['authentication', 'source', CameraUpstreamException],
		['tls_untrusted', 'source', CameraUpstreamException],
	])('maps %s (%s) to %p', (category, operation, expected) => {
		const error = toCameraProviderError(
			new ProtectApiError(category as ProtectErrorCategory, 'cameras/{id}/rtsps-stream'),
			operation as ProtectStreamOperation,
		);

		expect(error).toBeInstanceOf(expected);
	});

	it('never carries the original message', () => {
		const sources: unknown[] = [
			new Error('rtsp://h/SENTINELALIASx'),
			new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream'),
			'rtsps://h/SENTINELALIASx',
			null,
		];

		for (const source of sources) {
			const error = toCameraProviderError(source, 'source');

			expect(error.message).not.toContain('SENTINELALIAS');
			expect(error.message).not.toContain('rtsp');
			expect(error.stack ?? '').not.toContain('SENTINELALIAS');
		}

		expect(toCameraProviderError(new Error('rtsp://h/SENTINELALIASx'), 'source').message).toBe(
			'Camera did not respond',
		);
	});
});
