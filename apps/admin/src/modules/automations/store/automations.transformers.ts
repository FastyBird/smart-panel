import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { AutomationsValidationException } from '../automations.exceptions';

import { AutomationCreateReqSchema, AutomationGraphIssueSchema, AutomationSchema, AutomationUpdateReqSchema } from './automations.store.schemas';
import type {
	IAutomation,
	IAutomationCreateReq,
	IAutomationGraphIssue,
	IAutomationRes,
	IAutomationSummaryRes,
	IAutomationUpdateReq,
	IAutomationsAddActionPayload,
	IAutomationsEditActionPayload,
} from './automations.store.types';

/**
 * Converts the keys of an automation between the wire and the store format, leaving the graph alone:
 * it is stored as received, and the keys of node configurations must not be rewritten.
 */
const convertKeepingGraph = (
	data: Record<string, unknown>,
	convert: (obj: Record<string, unknown>) => Record<string, unknown>
): Record<string, unknown> => {
	const { graph, ...rest } = data;

	return typeof graph === 'undefined' ? convert(rest) : { ...convert(rest), graph };
};

export const transformAutomationResponse = <T extends IAutomation = IAutomation>(
	response: IAutomationRes | IAutomationSummaryRes | Record<string, unknown>,
	schema: typeof AutomationSchema = AutomationSchema
): T => {
	const parsed = schema.safeParse(convertKeepingGraph(response, snakeToCamel));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation data.');
	}

	return parsed.data as T;
};

export const transformAutomationCreateRequest = <T extends IAutomationCreateReq = IAutomationCreateReq>(
	data: IAutomationsAddActionPayload['data'] & { id?: string },
	schema: typeof AutomationCreateReqSchema = AutomationCreateReqSchema
): T => {
	const parsed = schema.safeParse(convertKeepingGraph(data, camelToSnake));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate create automation request.');
	}

	return parsed.data as T;
};

export const transformAutomationUpdateRequest = <T extends IAutomationUpdateReq = IAutomationUpdateReq>(
	data: IAutomationsEditActionPayload['data'] & { revision: number },
	schema: typeof AutomationUpdateReqSchema = AutomationUpdateReqSchema
): T => {
	const parsed = schema.safeParse(convertKeepingGraph(data, camelToSnake));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate update automation request.');
	}

	return parsed.data as T;
};

/**
 * Reads the issues of a refused graph. They only explain the refusal, so anything unreadable is
 * dropped rather than turned into another error.
 */
export const transformAutomationGraphIssues = (issues: unknown): IAutomationGraphIssue[] => {
	if (!Array.isArray(issues)) {
		return [];
	}

	return issues
		.map((issue) => AutomationGraphIssueSchema.safeParse(issue))
		.filter((parsed) => parsed.success)
		.map((parsed) => parsed.data);
};
