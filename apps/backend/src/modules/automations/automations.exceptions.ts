import { HttpStatus } from '@nestjs/common';

import { AutomationGraphSaveIssue } from './graph/save-policy';

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

/**
 * A manual run that was refused: the automation is disabled, invalid or suspended, the engine is not
 * running, or the run was asked to start at a node that is not a trigger.
 */
export class AutomationsNotTriggerableException extends AutomationsException {
	public readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

	public constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = 'AutomationsNotTriggerableException';
	}
}

/**
 * A graph that cannot be saved. Carries the issues so the caller can show each of them on its node or edge.
 */
export class AutomationsGraphValidationException extends AutomationsValidationException {
	public constructor(
		message: string,
		public readonly issues: AutomationGraphSaveIssue[],
	) {
		super(message);
		this.name = 'AutomationsGraphValidationException';
	}
}
