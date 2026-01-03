import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlugin } from '../../../common';
import { DEVICES_MODULE_NAME } from '../../../modules/devices';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException } from '../devices-home-assistant.exceptions';

import { useHomeAssistantStates } from './home-assistant-states.store';
import type { IHomeAssistantState, IHomeAssistantStatesSetActionPayload } from './home-assistant-states.store.types';

const entityId = '2fcdc656a7ae51e33482c8314b1d32b9';

const mockBackendClient = {
	GET: vi.fn(),
};

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: DEVICES_HOME_ASSISTANT_TYPE,
		modules: [DEVICES_MODULE_NAME],
	} as IPlugin,
]);

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
	};
});

describe('Home Assistant Discovered Devices Store', () => {
	let store: ReturnType<typeof useHomeAssistantStates>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useHomeAssistantStates();

		vi.clearAllMocks();
	});

	it('should fetch states', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
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
					},
				],
			},
		});

		const result = await store.fetch();

		expect(result[0]?.entityId).toBe(entityId);
		expect(store.firstLoadFinished()).toBe(true);
		expect(store.findAll()).toHaveLength(1);
		expect(store.findById(entityId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch()).rejects.toThrow(DevicesHomeAssistantApiException);
	});

	it('should get state by entity id', async () => {
		const testItem = {
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
		};

		store.data[entityId] = testItem as unknown as IHomeAssistantState;

		const found = store.findById(entityId);
		expect(found).toEqual(testItem);
	});

	it('should set a state manually', () => {
		const testItem: IHomeAssistantStatesSetActionPayload = {
			entityId: entityId,
			data: {
				state: 21.85,
				attributes: {
					stateClass: 'measurement',
					unitOfMeasurement: '°C',
					deviceClass: 'temperature',
				},
				lastChanged: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastReported: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastUpdated: new Date('2025-05-02T20:15:02.441749+00:00'),
			},
		};

		const state = store.set(testItem);

		expect(state.entityId).toBe(entityId);
		expect(store.findById(entityId)).toEqual(state);
	});

	it('should unset state', () => {
		const testItem: IHomeAssistantStatesSetActionPayload = {
			entityId: entityId,
			data: {
				state: 21.85,
				attributes: {
					stateClass: 'measurement',
					unitOfMeasurement: '°C',
					deviceClass: 'temperature',
				},
				lastChanged: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastReported: new Date('2025-05-02T20:15:02.441749+00:00'),
				lastUpdated: new Date('2025-05-02T20:15:02.441749+00:00'),
			},
		};

		const added = store.set(testItem);
		expect(store.data[entityId]).toEqual(added);

		store.unset({ entityId: entityId });

		expect(store.findAll()).toHaveLength(0);
	});
});
