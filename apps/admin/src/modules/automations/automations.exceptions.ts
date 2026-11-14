import type { AutomationTriggerRefusal } from './automations.constants';
import type { IAutomationGraphIssue } from './store/automations.store.types';
import type { IAutomationTemplateIssue } from './store/templates.store.types';
import type { IAutomationImportIssue } from './store/transfer.store.types';

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
 * The backend refused the answers to the questions of a template (422 with `automation-template-parameters-invalid`).
 * Each issue is addressed to its question, `parameters.<id>` or `parameters.<id>.<field>`.
 */
export class AutomationsTemplateParametersException extends AutomationsApiException {
	public issues: IAutomationTemplateIssue[];

	constructor(message: string, issues: IAutomationTemplateIssue[] = [], exception: Error | null = null) {
		super(message, 422, exception);
		this.name = 'AutomationsTemplateParametersException';
		this.issues = issues;
	}
}

/**
 * The backend could not read an import file as an automation (422 with `automation-import-invalid`). Each issue is
 * addressed to a part of the document, such as `graph.nodes.0.type`, or of the request, such as `mappings.0.to`.
 */
export class AutomationsImportInvalidException extends AutomationsApiException {
	public issues: IAutomationImportIssue[];

	constructor(message: string, issues: IAutomationImportIssue[] = [], exception: Error | null = null) {
		super(message, 422, exception);
		this.name = 'AutomationsImportInvalidException';
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
