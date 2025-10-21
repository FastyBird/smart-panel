import { describe, expect, it, vi } from 'vitest';

import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

import type { IHomeAssistantStateRes } from './home-assistant-states.store.types';
import { transformHomeAssistantStateResponse } from './home-assistant-states.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const entityId = 'sensor.hall_heater_floor_temperature';

const validHomeAssistantStateResponse: IHomeAssistantStateRes = {
	entity_id: entityId,
	state: 21.85,
	attributes: {
		state_class: 'measurement',
		unit_of_measurement: '°C',
		device_class: 'temperature',
	},
	last_changed: '2025-05-02T20:15:02.441749+00:00',
	last_reported: '2025-05-02T20:15:02.441749+00:00',
	last_updated: '2025-05-02T20:15:02.441749+00:00',
};

describe('HomeAssistantStates Transformers', (): void => {
	describe('transformHomeAssistantStateResponse', (): void => {
		it('should transform a valid Home Assistant state response', (): void => {
			const result = transformHomeAssistantStateResponse(validHomeAssistantStateResponse);

			expect(result).toEqual({
				entityId: entityId,
				state: 21.85,
				attributes: {
					stateClass: 'measurement',
					unitOfMeasurement: '°C',
					deviceClass: 'temperature',
				},
				lastChanged: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastReported: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastUpdated: new Date('2025-05-02T20:15:02.441749+00:00'),
			});
		});

		it('should throw an error for an invalid Home Assistant state response', (): void => {
			expect(() =>
				transformHomeAssistantStateResponse({
					...validHomeAssistantStateResponse,
					entity_id: null,
				} as unknown as IHomeAssistantStateRes)
			).toThrow(DevicesHomeAssistantValidationException);
		});
	});
});
