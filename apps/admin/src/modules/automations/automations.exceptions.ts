import type { AutomationTriggerRefusal } from './automations.constants';
import type { IAutomationGraphIssue } from './store/automations.store.types';

export class AutomationsException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'AutomationsException';
		this.exception = exception;
	}
}

export class AutomationsApiException extends AutomationsException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'AutomationsApiException';
		this.code = code;
	}
}

/**
 * The automation was changed elsewhere since the revision the update was based on (409).
 */
export class AutomationsRevisionConflictException extends AutomationsApiException {
	constructor(message: string, exception: Error | null = null) {
		super(message, 409, exception);
		this.name = 'AutomationsRevisionConflictException';
	}
}

/**
 * The backend refused a save because of the automation graph (422 with `automation-graph-invalid`).
 */
export class AutomationsGraphInvalidException extends AutomationsApiException {
	public issues: IAutomationGraphIssue[];

	constructor(message: string, issues: IAutomationGraphIssue[] = [], exception: Error | null = null) {
		super(message, 422, exception);
		this.name = 'AutomationsGraphInvalidException';
		this.issues = issues;
	}
}

/**
 * The backend refused to start a run by hand (422). `reason` says why, as `error.details.code` names it.
 */
export class AutomationsTriggerRefusedException extends AutomationsApiException {
	public reason: AutomationTriggerRefusal | null;

	constructor(message: string, reason: AutomationTriggerRefusal | null, exception: Error | null = null) {
		super(message, 422, exception);
		this.name = 'AutomationsTriggerRefusedException';
		this.reason = reason;
	}
}

export class AutomationsValidationException extends AutomationsException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'AutomationsValidationException';
	}
}
