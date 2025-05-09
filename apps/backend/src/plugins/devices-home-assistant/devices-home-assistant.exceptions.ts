export class DevicesHomeAssistantException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeAssistantException';
	}
}

export class DevicesHomeAssistantNotFoundException extends DevicesHomeAssistantException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeAssistantNotFoundException';
	}
}

export class DevicesHomeAssistantValidationException extends DevicesHomeAssistantException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeAssistantValidationException';
	}
}

export class DevicesHomeAssistantNotAllowedException extends DevicesHomeAssistantException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeAssistantNotAllowedException';
	}
}
