import { snakeToCamel } from '../../../common';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantStateSchema } from './home-assistant-states.store.schemas';
import type { IHomeAssistantState, IHomeAssistantStateRes } from './home-assistant-states.store.types';

export const transformHomeAssistantStateResponse = (response: IHomeAssistantStateRes): IHomeAssistantState => {
	const parsedHomeAssistantState = HomeAssistantStateSchema.safeParse(snakeToCamel(response));

	if (!parsedHomeAssistantState.success) {
		console.error('Schema validation failed with:', parsedHomeAssistantState.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate received Home Assistant state data.');
	}

	return parsedHomeAssistantState.data;
};
