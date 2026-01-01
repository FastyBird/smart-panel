import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
	SpacesModuleDataSpaceCategory,
} from '../../../openapi';
import { SpaceCategory, SpaceType } from '../spaces.constants';

import type { ISpaceCreateData, ISpaceEditData } from './spaces.store.types';
import type { ApiSpace } from './spaces.transformers';
import { transformSpaceCreateRequest, transformSpaceEditRequest, transformSpaceResponse } from './spaces.transformers';

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

const spaceId = uuid();
const parentId = uuid();
const thermostatId = uuid();
const sensorId = uuid();

const validRoomResponse: ApiSpace = {
	id: spaceId.toString(),
	name: 'Living Room',
	description: 'Main living area',
	type: SpacesModuleCreateSpaceType.room,
	category: SpacesModuleDataSpaceCategory.living_room,
	icon: 'mdi:sofa',
	display_order: 1,
	parent_id: parentId.toString(),
	primary_thermostat_id: thermostatId.toString(),
	primary_temperature_sensor_id: sensorId.toString(),
	suggestions_enabled: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validZoneResponse: ApiSpace = {
	id: uuid().toString(),
	name: 'Ground Floor',
	description: 'First level of the house',
	type: SpacesModuleCreateSpaceType.zone,
	category: SpacesModuleDataSpaceCategory.floor_ground,
	icon: 'mdi:home-floor-0',
	display_order: 0,
	parent_id: null,
	primary_thermostat_id: null,
	primary_temperature_sensor_id: null,
	suggestions_enabled: false,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
};

const validSpaceCreatePayload: ISpaceCreateData = {
	name: 'New Room',
	description: 'A new room',
	type: SpaceType.ROOM,
	category: SpaceCategory.BEDROOM,
	icon: 'mdi:bed',
	displayOrder: 5,
	parentId: parentId.toString(),
	primaryThermostatId: thermostatId.toString(),
	primaryTemperatureSensorId: sensorId.toString(),
	suggestionsEnabled: true,
};

const validSpaceEditPayload: ISpaceEditData = {
	name: 'Updated Room',
	description: 'Updated description',
	type: SpaceType.ROOM,
	category: SpaceCategory.OFFICE,
	icon: 'mdi:desk',
	displayOrder: 10,
	suggestionsEnabled: false,
};

describe('Spaces Transformers', (): void => {
	describe('transformSpaceResponse', (): void => {
		it('should transform a valid room response', (): void => {
			const result = transformSpaceResponse(validRoomResponse);

			expect(result).toEqual({
				id: spaceId.toString(),
				name: 'Living Room',
				description: 'Main living area',
				type: SpaceType.ROOM,
				category: SpaceCategory.LIVING_ROOM,
				icon: 'mdi:sofa',
				displayOrder: 1,
				parentId: parentId.toString(),
				primaryThermostatId: thermostatId.toString(),
				primaryTemperatureSensorId: sensorId.toString(),
				suggestionsEnabled: true,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
				draft: false,
			});
		});

		it('should transform a valid zone response', (): void => {
			const result = transformSpaceResponse(validZoneResponse);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceCategory.FLOOR_GROUND);
			expect(result.parentId).toBeNull();
			expect(result.updatedAt).toBeNull();
			expect(result.draft).toBe(false);
		});

		it('should handle null optional fields', (): void => {
			const responseWithNulls = {
				...validRoomResponse,
				description: null,
				category: undefined,
				icon: null,
				display_order: undefined,
				parent_id: null,
				primary_thermostat_id: null,
				primary_temperature_sensor_id: null,
				suggestions_enabled: undefined,
				updated_at: null,
			} as unknown as ApiSpace;

			const result = transformSpaceResponse(responseWithNulls);

			expect(result.description).toBeNull();
			expect(result.category).toBeNull();
			expect(result.icon).toBeNull();
			expect(result.displayOrder).toBe(0);
			expect(result.parentId).toBeNull();
			expect(result.primaryThermostatId).toBeNull();
			expect(result.primaryTemperatureSensorId).toBeNull();
			expect(result.suggestionsEnabled).toBe(true);
			expect(result.updatedAt).toBeNull();
		});
	});

	describe('transformSpaceCreateRequest', (): void => {
		it('should transform a valid space create request', (): void => {
			const result = transformSpaceCreateRequest(validSpaceCreatePayload);

			expect(result).toEqual({
				name: 'New Room',
				description: 'A new room',
				type: SpacesModuleCreateSpaceType.room,
				category: SpacesModuleCreateSpaceCategory.bedroom,
				icon: 'mdi:bed',
				display_order: 5,
				parent_id: parentId.toString(),
				primary_thermostat_id: thermostatId.toString(),
				primary_temperature_sensor_id: sensorId.toString(),
				suggestions_enabled: true,
			});
		});

		it('should transform zone create request', (): void => {
			const zonePayload: ISpaceCreateData = {
				name: 'New Zone',
				type: SpaceType.ZONE,
				category: SpaceCategory.FLOOR_FIRST,
			};

			const result = transformSpaceCreateRequest(zonePayload);

			expect(result.name).toBe('New Zone');
			expect(result.type).toBe(SpacesModuleCreateSpaceType.zone);
			expect(result.category).toBe(SpacesModuleCreateSpaceCategory.floor_first);
		});

		it('should handle undefined optional fields', (): void => {
			const minimalPayload: ISpaceCreateData = {
				name: 'Minimal Room',
			};

			const result = transformSpaceCreateRequest(minimalPayload);

			expect(result.name).toBe('Minimal Room');
			expect(result.type).toBe(SpacesModuleCreateSpaceType.room); // default
			expect(result.description).toBeUndefined();
			expect(result.icon).toBeUndefined();
		});

		it('should handle null values for optional fields', (): void => {
			const payloadWithNulls: ISpaceCreateData = {
				name: 'Room with nulls',
				description: null,
				category: null,
				icon: null,
				parentId: null,
			};

			const result = transformSpaceCreateRequest(payloadWithNulls);

			expect(result.name).toBe('Room with nulls');
			expect(result.description).toBeUndefined();
			expect(result.category).toBeUndefined();
			expect(result.icon).toBeUndefined();
			expect(result.parent_id).toBeUndefined();
		});
	});

	describe('transformSpaceEditRequest', (): void => {
		it('should transform a valid space edit request', (): void => {
			const result = transformSpaceEditRequest(validSpaceEditPayload);

			expect(result).toEqual({
				name: 'Updated Room',
				description: 'Updated description',
				type: SpacesModuleCreateSpaceType.room,
				category: SpacesModuleCreateSpaceCategory.office,
				icon: 'mdi:desk',
				display_order: 10,
				suggestions_enabled: false,
			});
		});

		it('should include null for parentId when explicitly set', (): void => {
			const payloadWithNullParent: ISpaceEditData = {
				name: 'Room',
				parentId: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullParent);

			expect(result).toBeDefined();
			expect(result!.parent_id).toBeNull();
		});

		it('should include null for primaryThermostatId when explicitly set', (): void => {
			const payloadWithNullThermostat: ISpaceEditData = {
				name: 'Room',
				primaryThermostatId: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullThermostat);

			expect(result).toBeDefined();
			expect(result!.primary_thermostat_id).toBeNull();
		});

		it('should include null for primaryTemperatureSensorId when explicitly set', (): void => {
			const payloadWithNullSensor: ISpaceEditData = {
				name: 'Room',
				primaryTemperatureSensorId: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullSensor);

			expect(result).toBeDefined();
			expect(result!.primary_temperature_sensor_id).toBeNull();
		});

		it('should not include parent_id when not in data', (): void => {
			const payloadWithoutParent: ISpaceEditData = {
				name: 'Room',
			};

			const result = transformSpaceEditRequest(payloadWithoutParent);

			expect(result).toBeDefined();
			expect('parent_id' in result!).toBe(false);
		});

		it('should handle category being set to null', (): void => {
			const payloadWithNullCategory: ISpaceEditData = {
				name: 'Room',
				category: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullCategory);

			expect(result).toBeDefined();
			expect(result!.category).toBeNull();
		});
	});
});
