import { logger } from '../../../common';
import { AutomationsValidationException } from '../automations.exceptions';

import { AutomationTemplateDraftSchema, AutomationTemplateIssueSchema, AutomationTemplateSchema } from './templates.store.schemas';
import type {
	IAutomationTemplate,
	IAutomationTemplateDraft,
	IAutomationTemplateIssue,
	IAutomationTemplateParameterRes,
	IAutomationTemplateRes,
} from './templates.store.types';

const transformParameter = (parameter: IAutomationTemplateParameterRes | Record<string, unknown>): Record<string, unknown> => {
	const {
		channel_categories: channelCategories,
		property_categories: propertyCategories,
		data_types: dataTypes,
		max_length: maxLength,
		...rest
	} = parameter as IAutomationTemplateParameterRes;

	return { ...rest, channelCategories, propertyCategories, dataTypes, maxLength };
};

export const transformAutomationTemplateResponse = (response: IAutomationTemplateRes | Record<string, unknown>): IAutomationTemplate => {
	const { parameters, ...rest } = response as IAutomationTemplateRes;

	const parsed = AutomationTemplateSchema.safeParse({
		...rest,
		parameters: Array.isArray(parameters) ? parameters.map(transformParameter) : parameters,
	});

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation template data.');
	}

	return parsed.data;
};

// The graph is kept as received: node configurations belong to the node types and are never case converted
export const transformAutomationTemplateDraftResponse = (response: unknown): IAutomationTemplateDraft => {
	const parsed = AutomationTemplateDraftSchema.safeParse(response);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation template draft data.');
	}

	return parsed.data;
};

export const transformAutomationTemplateIssues = (issues: unknown): IAutomationTemplateIssue[] => {
	if (!Array.isArray(issues)) {
		return [];
	}

	return issues
		.map((issue) => AutomationTemplateIssueSchema.safeParse(issue))
		.filter((parsed) => parsed.success)
		.map((parsed) => parsed.data);
};
