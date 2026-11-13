export class CamerasException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CamerasException';
	}
}

export class CamerasNotFoundException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CamerasNotFoundException';
	}
}

export class CameraOfflineException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CameraOfflineException';
	}
}

export class CameraRateLimitedException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CameraRateLimitedException';
	}
}

export class CameraProfileUnavailableException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CameraProfileUnavailableException';
	}
}

export class CameraUpstreamException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CameraUpstreamException';
	}
}

export class CamerasForbiddenException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'CamerasForbiddenException';
	}
}

export class Go2rtcUnavailableException extends CamerasException {
	constructor(message: string) {
		super(message);
		this.name = 'Go2rtcUnavailableException';
	}
}

/** A failed call to go2rtc. `status` is the HTTP status, or `null` when there was no response. Never carries a url. */
export class Go2rtcApiError extends Error {
	constructor(readonly status: number | null) {
		super('go2rtc request failed');
		this.name = 'Go2rtcApiError';
	}
}

export class CameraProviderTimeoutError extends Error {
	constructor() {
		super('Camera provider call timed out');
		this.name = 'CameraProviderTimeoutError';
	}
}

/**
 * Names an error for log output from a fixed set of literals.
 *
 * Never reads `error.name` or `error.message`: a provider controls both and may put a source URL in either.
 */
export function errorName(error: unknown): string {
	if (error instanceof CameraProviderTimeoutError) return 'CameraProviderTimeoutError';
	if (error instanceof CamerasNotFoundException) return 'CamerasNotFoundException';
	if (error instanceof CameraOfflineException) return 'CameraOfflineException';
	if (error instanceof CameraRateLimitedException) return 'CameraRateLimitedException';
	if (error instanceof CameraProfileUnavailableException) return 'CameraProfileUnavailableException';
	if (error instanceof CameraUpstreamException) return 'CameraUpstreamException';
	if (error instanceof CamerasForbiddenException) return 'CamerasForbiddenException';
	if (error instanceof Go2rtcUnavailableException) return 'Go2rtcUnavailableException';
	if (error instanceof CamerasException) return 'CamerasException';
	if (error instanceof Go2rtcApiError) return 'Go2rtcApiError';
	if (error instanceof Error) return 'ProviderError';

	return 'UnknownError';
}

/**
 * Normalises an error thrown by a camera provider before it leaves the provider boundary.
 *
 * Only offline, rate limited and profile unavailable are meaningful to a caller; everything else, including any
 * other `CamerasException` a provider throws, becomes a `CameraUpstreamException`. The result always carries a fixed
 * message, because a provider may embed a source URL or alias in its own.
 */
export function sanitizeProviderError(error: unknown): CamerasException {
	if (error instanceof CameraOfflineException) {
		return new CameraOfflineException('Camera is offline');
	}

	if (error instanceof CameraRateLimitedException) {
		return new CameraRateLimitedException('Camera is busy');
	}

	if (error instanceof CameraProfileUnavailableException) {
		return new CameraProfileUnavailableException('Stream profile is not available');
	}

	return new CameraUpstreamException('Camera did not respond');
}
