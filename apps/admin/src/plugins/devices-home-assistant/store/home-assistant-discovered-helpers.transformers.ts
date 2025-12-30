import { logger } from '../../../common';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantDiscoveredHelperResSchema, HomeAssistantDiscoveredHelperSchema } from './home-assistant-discovered-helpers.store.schemas';
import type { IHomeAssistantDiscoveredHelper, IHomeAssistantDiscoveredHelperRes } from './home-assistant-discovered-helpers.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';

export const transformHomeAssistantDiscoveredHelperResponse = (
	response: IHomeAssistantDiscoveredHelperRes,
): IHomeAssistantDiscoveredHelper => {
	// Validate raw response structure first
	const parsedRes = HomeAssistantDiscoveredHelperResSchema.safeParse(response);

	if (!parsedRes.success) {
		logger.error('Helper response validation failed with:', parsedRes.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate Home Assistant helper response.');
	}

	const validated = parsedRes.data;

	// Transform and validate the final structure
	const transformed = {
		entityId: validated.entity_id,
		name: validated.name,
		domain: validated.domain,
		adoptedDeviceId: validated.adopted_device_id,
		state: validated.state ? transformHomeAssistantStateResponse(validated.state) : null,
	};

	const parsedHelper = HomeAssistantDiscoveredHelperSchema.safeParse(transformed);

	if (!parsedHelper.success) {
		logger.error('Helper transformation validation failed with:', parsedHelper.error);

		throw new DevicesHomeAssistantValidationException('Failed to transform Home Assistant helper data.');
	}

	return parsedHelper.data;
};
