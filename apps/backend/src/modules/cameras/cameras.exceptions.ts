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
