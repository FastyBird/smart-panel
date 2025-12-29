import type { IHomeAssistantDiscoveredHelper, IHomeAssistantDiscoveredHelperRes } from './home-assistant-discovered-helpers.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';

export const transformHomeAssistantDiscoveredHelperResponse = (
	response: IHomeAssistantDiscoveredHelperRes,
): IHomeAssistantDiscoveredHelper => {
	return {
		entityId: response.entity_id,
		name: response.name,
		domain: response.domain,
		adoptedDeviceId: response.adopted_device_id,
		state: response.state ? transformHomeAssistantStateResponse(response.state) : null,
	};
};
