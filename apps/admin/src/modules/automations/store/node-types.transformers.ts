import { logger } from '../../../common';
import { AutomationsValidationException } from '../automations.exceptions';

import { AutomationNodeTypeSchema } from './node-types.store.schemas';
import type { IAutomationNodeType, IAutomationNodeTypeRes } from './node-types.store.types';

export const transformAutomationNodeTypeResponse = (response: IAutomationNodeTypeRes | Record<string, unknown>): IAutomationNodeType => {
	// Only the outer key is renamed; the JSON Schema inside is configuration data and stays as it is
	const { config_schema: configSchema, unavailable_reason: unavailableReason, ...rest } = response as Record<string, unknown>;

	const parsed = AutomationNodeTypeSchema.safeParse({
		...rest,
		...(typeof configSchema === 'undefined' ? {} : { configSchema }),
		...(typeof unavailableReason === 'undefined' ? {} : { unavailableReason }),
	});

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation node type data.');
	}

	return parsed.data;
};
