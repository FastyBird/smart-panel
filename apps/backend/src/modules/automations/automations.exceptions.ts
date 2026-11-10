import { HttpStatus } from '@nestjs/common';

export class AutomationsException extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'AutomationsException';
	}
}

export class AutomationsNotFoundException extends AutomationsException {
	public readonly status = HttpStatus.NOT_FOUND;

	public constructor(message: string) {
		super(message);
		this.name = 'AutomationsNotFoundException';
	}
}

export class AutomationsValidationException extends AutomationsException {
	public readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

	public constructor(message: string) {
		super(message);
		this.name = 'AutomationsValidationException';
	}
}

export class AutomationsSpaceValidationException extends AutomationsException {
	public readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

	public constructor(message: string) {
		super(message);
		this.name = 'AutomationsSpaceValidationException';
	}
}

export class AutomationsRevisionConflictException extends AutomationsException {
	public readonly status = HttpStatus.CONFLICT;

	public constructor(message: string) {
		super(message);
		this.name = 'AutomationsRevisionConflictException';
	}
}
