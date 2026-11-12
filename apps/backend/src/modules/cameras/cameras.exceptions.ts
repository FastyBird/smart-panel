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
