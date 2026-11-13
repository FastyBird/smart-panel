import { logger, snakeToCamel } from '../../../common';
import { AutomationsValidationException } from '../automations.exceptions';

import { AutomationRunSchema, AutomationRunStepSchema, AutomationRuntimeSchema, AutomationTriggerResultSchema } from './runs.store.schemas';
import type { IAutomationRun, IAutomationRunStep, IAutomationRuntime, IAutomationTriggerResult } from './runs.store.types';

/**
 * Converts the keys of a run to the store format, leaving the trace alone: it is a document kept as
 * received, and what its steps observed belongs to the node types.
 */
export const transformAutomationRunResponse = (response: Record<string, unknown>): IAutomationRun => {
	const { trace, ...rest } = response;

	const parsed = AutomationRunSchema.safeParse(typeof trace === 'undefined' ? snakeToCamel(rest) : { ...snakeToCamel(rest), trace });

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation run data.');
	}

	return parsed.data;
};

/**
 * Reads one step of a run as the live view receives it. A step it cannot read is dropped: it only lights
 * up a card, and the stored trace is read once the run is over.
 */
export const transformAutomationRunStep = (step: unknown): IAutomationRunStep | null => {
	const parsed = AutomationRunStepSchema.safeParse(step);

	return parsed.success ? parsed.data : null;
};

export const transformAutomationTriggerResultResponse = (response: Record<string, unknown>): IAutomationTriggerResult => {
	const parsed = AutomationTriggerResultSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation trigger result.');
	}

	return parsed.data;
};

export const transformAutomationRuntimeResponse = (response: Record<string, unknown>): IAutomationRuntime => {
	// The problems are addressed to nodes and edges of the graph, whose keys are snake_case as well
	const { problems, ...rest } = response;

	const parsed = AutomationRuntimeSchema.safeParse({
		...snakeToCamel(rest),
		problems: Array.isArray(problems) ? problems : [],
	});

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation runtime data.');
	}

	return parsed.data;
};
