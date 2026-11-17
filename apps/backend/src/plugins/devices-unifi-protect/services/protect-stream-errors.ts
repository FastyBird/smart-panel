import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasException,
} from '../../../modules/cameras/cameras.exceptions';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

export type ProtectStreamOperation = 'source' | 'snapshot' | 'bridge';

/**
 * D8. Maps a failure to a core exception with a fixed text. Never reads `error.message` or `error.name`: the original
 * can carry a console address or an RTSPS alias.
 */
export function toCameraProviderError(error: unknown, operation: ProtectStreamOperation): CamerasException {
	if (!(error instanceof ProtectApiError)) {
		return new CameraUpstreamException('Camera did not respond');
	}

	switch (error.category) {
		case ProtectErrorCategory.TLS_UNTRUSTED:
		case ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH:
			return operation === 'bridge'
				? new CameraProfileUnavailableException('Stream profile is not available')
				: new CameraUpstreamException('Camera did not respond');
		case ProtectErrorCategory.UNAVAILABLE:
		case ProtectErrorCategory.NOT_FOUND:
			// The bridge's `unavailable` means no listener (relay down), which is not a camera that is off.
			return operation === 'bridge'
				? new CameraUpstreamException('Camera did not respond')
				: new CameraOfflineException('Camera is offline');
		case ProtectErrorCategory.RATE_LIMITED:
			return operation === 'bridge'
				? new CameraUpstreamException('Camera did not respond')
				: new CameraRateLimitedException('Camera is busy');
		default:
			return new CameraUpstreamException('Camera did not respond');
	}
}
