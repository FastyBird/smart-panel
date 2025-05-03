import { describe, expect, it } from 'vitest';

import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import type { IHomeAssistantDiscoveredDeviceRes } from './home-assistant-discovered-devices.store.types';
import { transformHomeAssistantDiscoveredDeviceResponse } from './home-assistant-discovered-devices.transformers';

const deviceId = '2fcdc656a7ae51e33482c8314b1d32b9';

const validHomeAssistantDiscoveredDeviceResponse: IHomeAssistantDiscoveredDeviceRes = {
	id: deviceId,
	name: 'Home Assistant device',
	entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
	adopted_device_id: null,
	states: [],
};

describe('HomeAssistantDiscoveredDevices Transformers', (): void => {
	describe('transformHomeAssistantDiscoveredDeviceResponse', (): void => {
		it('should transform a valid Home Assistant discovered device response', (): void => {
			const result = transformHomeAssistantDiscoveredDeviceResponse(validHomeAssistantDiscoveredDeviceResponse);

			expect(result).toEqual({
				id: deviceId,
				name: 'Home Assistant device',
				entities: ['switch.hall_heater_actor', 'sensor.hall_heater_voltage'],
				adoptedDeviceId: null,
			});
		});

		it('should throw an error for an invalid Home Assistant discovered device response', (): void => {
			expect(() =>
				transformHomeAssistantDiscoveredDeviceResponse({
					...validHomeAssistantDiscoveredDeviceResponse,
					id: null,
				} as unknown as IHomeAssistantDiscoveredDeviceRes)
			).toThrow(DevicesHomeAssistantValidationException);
		});
	});
});
