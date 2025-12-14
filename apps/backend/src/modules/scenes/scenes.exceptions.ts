import { HttpStatus } from '@nestjs/common';

export class ScenesException extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'ScenesException';
	}
}

export class ScenesNotFoundException extends ScenesException {
	public readonly status = HttpStatus.NOT_FOUND;

	public constructor(message: string) {
		super(message);
		this.name = 'ScenesNotFoundException';
	}
}

export class ScenesValidationException extends ScenesException {
	public readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

	public constructor(message: string) {
		super(message);
		this.name = 'ScenesValidationException';
	}
}

export class ScenesNotEditableException extends ScenesException {
	public readonly status = HttpStatus.FORBIDDEN;

	public constructor(message: string) {
		super(message);
		this.name = 'ScenesNotEditableException';
	}
}

export class ScenesNotTriggerableException extends ScenesException {
	public readonly status = HttpStatus.FORBIDDEN;

	public constructor(message: string) {
		super(message);
		this.name = 'ScenesNotTriggerableException';
	}
}

export class ScenesExecutionException extends ScenesException {
	public readonly status = HttpStatus.INTERNAL_SERVER_ERROR;

	public constructor(message: string) {
		super(message);
		this.name = 'ScenesExecutionException';
	}
}
