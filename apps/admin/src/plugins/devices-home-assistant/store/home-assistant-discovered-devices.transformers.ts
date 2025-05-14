import { snakeToCamel } from '../../../common';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import { HomeAssistantDiscoveredDeviceSchema } from './home-assistant-discovered-devices.store.schemas';
import type { IHomeAssistantDiscoveredDevice, IHomeAssistantDiscoveredDeviceRes } from './home-assistant-discovered-devices.store.types';

export const transformHomeAssistantDiscoveredDeviceResponse = (response: IHomeAssistantDiscoveredDeviceRes): IHomeAssistantDiscoveredDevice => {
	const parsedHomeAssistantDiscoveredDevice = HomeAssistantDiscoveredDeviceSchema.safeParse(snakeToCamel(response));

	if (!parsedHomeAssistantDiscoveredDevice.success) {
		console.error('Schema validation failed with:', parsedHomeAssistantDiscoveredDevice.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate received Home Assistant device data.');
	}

	return parsedHomeAssistantDiscoveredDevice.data;
};
