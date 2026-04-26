import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
	SpacesModuleEnergyWidgetRange,
} from '../../../openapi.constants';
import {
	ENERGY_WIDGET_DEFAULTS,
	EnergyWidgetRange,
	StatusWidgetType,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from '../spaces.constants';

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

const validRoomResponse: ApiSpace = {
	id: spaceId.toString(),
	name: 'Living Room',
	description: 'Main living area',
	type: SpacesModuleCreateSpaceType.room,
	category: SpacesModuleCreateSpaceCategory.living_room,
	icon: 'mdi:sofa',
	display_order: 1,
	parent_id: parentId.toString(),
	suggestions_enabled: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validZoneResponse: ApiSpace = {
	id: uuid().toString(),
	name: 'Ground Floor',
	description: 'First level of the house',
	type: SpacesModuleCreateSpaceType.zone,
	category: SpacesModuleCreateSpaceCategory.floor_ground,
	icon: 'mdi:home-floor-0',
	display_order: 0,
	parent_id: null,
	suggestions_enabled: false,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
};

const validSpaceCreatePayload: ISpaceCreateData = {
	name: 'New Room',
	description: 'A new room',
	type: SpaceType.ROOM,
	category: SpaceRoomCategory.BEDROOM,
	icon: 'mdi:bed',
	displayOrder: 5,
	parentId: parentId.toString(),
	suggestionsEnabled: true,
};

const validSpaceEditPayload: ISpaceEditData = {
	name: 'Updated Room',
	description: 'Updated description',
	type: SpaceType.ROOM,
	category: SpaceRoomCategory.OFFICE,
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
				category: SpaceRoomCategory.LIVING_ROOM,
				icon: 'mdi:sofa',
				displayOrder: 1,
				parentId: parentId.toString(),
				suggestionsEnabled: true,
				statusWidgets: null,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
				draft: false,
			});
		});

		it('should transform a valid zone response', (): void => {
			const result = transformSpaceResponse(validZoneResponse);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
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
				suggestions_enabled: undefined,
				updated_at: null,
			} as unknown as ApiSpace;

			const result = transformSpaceResponse(responseWithNulls);

			expect(result.description).toBeNull();
			expect(result.category).toBeNull();
			expect(result.icon).toBeNull();
			expect(result.displayOrder).toBe(0);
			expect(result.parentId).toBeNull();
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
				suggestions_enabled: true,
				status_widgets: undefined,
			});
		});

		it('should transform zone create request', (): void => {
			const zonePayload: ISpaceCreateData = {
				name: 'New Zone',
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_FIRST,
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
				type: SpaceType.ROOM,
				category: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullCategory);

			expect(result).toBeDefined();
			expect(result!.category).toBeNull();
		});

		it('should include status_widgets when present in data', (): void => {
			const payloadWithWidgets: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
				statusWidgets: [
					{
						type: StatusWidgetType.ENERGY,
						order: 0,
						settings: {
							range: EnergyWidgetRange.TODAY,
							showProduction: true,
						},
					},
				],
			};

			const result = transformSpaceEditRequest(payloadWithWidgets);

			expect(result).toBeDefined();
			expect((result as Record<string, unknown>).status_widgets).toEqual([
				{
					type: 'energy',
					order: 0,
					settings: {
						range: 'today',
						show_production: true,
					},
				},
			]);
		});

		it('should not include status_widgets when not in data', (): void => {
			const payloadWithoutWidgets: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
			};

			const result = transformSpaceEditRequest(payloadWithoutWidgets);

			expect(result).toBeDefined();
			expect('status_widgets' in result!).toBe(false);
		});

		it('should include null status_widgets when explicitly set to null', (): void => {
			const payloadWithNullWidgets: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
				statusWidgets: null,
			};

			const result = transformSpaceEditRequest(payloadWithNullWidgets);

			expect(result).toBeDefined();
			expect((result as Record<string, unknown>).status_widgets).toBeNull();
		});

		// Codex P1: home-control fields must be stripped when the target
		// space type is master / entry / signage. The shared edit form
		// composable always populates `category` / `suggestionsEnabled` /
		// `statusWidgets` on the model, so without a type-aware filter
		// the transformer would emit them and the per-type backend DTO
		// would 422 the request.
		it('strips home-control fields when editing a MASTER space', (): void => {
			const payloadForMaster: ISpaceEditData = {
				name: 'Smart Home',
				type: SpaceType.MASTER,
				category: null,
				suggestionsEnabled: true,
				statusWidgets: null,
			};

			const result = transformSpaceEditRequest(payloadForMaster) as Record<string, unknown>;

			expect(result.name).toBe('Smart Home');
			expect('category' in result).toBe(false);
			expect('suggestions_enabled' in result).toBe(false);
			expect('status_widgets' in result).toBe(false);
		});

		it('strips home-control fields when editing an ENTRY space', (): void => {
			const payloadForEntry: ISpaceEditData = {
				name: 'Front Door',
				type: SpaceType.ENTRY,
				category: null,
				suggestionsEnabled: true,
				statusWidgets: null,
			};

			const result = transformSpaceEditRequest(payloadForEntry) as Record<string, unknown>;

			expect('category' in result).toBe(false);
			expect('suggestions_enabled' in result).toBe(false);
			expect('status_widgets' in result).toBe(false);
		});

		it('strips home-control fields when editing a SIGNAGE_INFO_PANEL space', (): void => {
			const payloadForSignage: ISpaceEditData = {
				name: 'Lobby Display',
				type: SpaceType.SIGNAGE_INFO_PANEL,
				category: null,
				suggestionsEnabled: true,
				statusWidgets: null,
			};

			const result = transformSpaceEditRequest(payloadForSignage) as Record<string, unknown>;

			expect('category' in result).toBe(false);
			expect('suggestions_enabled' in result).toBe(false);
			expect('status_widgets' in result).toBe(false);
		});

		it('strips home-control fields when create payload targets a MASTER space', (): void => {
			const payloadForMaster: ISpaceCreateData = {
				name: 'Smart Home',
				type: SpaceType.MASTER,
				category: null,
				suggestionsEnabled: true,
				statusWidgets: null,
			};

			const result = transformSpaceCreateRequest(payloadForMaster) as Record<string, unknown>;

			expect('category' in result).toBe(false);
			expect('suggestions_enabled' in result).toBe(false);
			expect('status_widgets' in result).toBe(false);
		});
	});

	describe('status widgets transformations', (): void => {
		it('should transform API response with energy status widget', (): void => {
			const responseWithWidget: ApiSpace = {
				...validRoomResponse,
				status_widgets: [
					{
						type: 'energy',
						order: 0,
						settings: {
							range: SpacesModuleEnergyWidgetRange.today,
							show_production: true,
						},
					},
				],
			};

			const result = transformSpaceResponse(responseWithWidget);

			expect(result.statusWidgets).toEqual([
				{
					type: 'energy',
					order: 0,
					settings: {
						range: 'today',
						showProduction: true,
					},
				},
			]);
		});

		it('should transform API response with null status_widgets', (): void => {
			const responseWithNull: ApiSpace = {
				...validRoomResponse,
				status_widgets: null,
			};

			const result = transformSpaceResponse(responseWithNull);

			expect(result.statusWidgets).toBeNull();
		});

		it('should transform API response with no status_widgets field', (): void => {
			const result = transformSpaceResponse(validRoomResponse);

			expect(result.statusWidgets).toBeNull();
		});

		it('should correctly transform showProduction from snake_case to camelCase', (): void => {
			const responseWithWidget: ApiSpace = {
				...validRoomResponse,
				status_widgets: [
					{
						type: 'energy',
						order: 0,
						settings: {
							range: SpacesModuleEnergyWidgetRange.week,
							show_production: false,
						},
					},
				],
			};

			const result = transformSpaceResponse(responseWithWidget);

			expect(result.statusWidgets).not.toBeNull();
			expect(result.statusWidgets!.length).toBeGreaterThan(0);

			const widget = result.statusWidgets![0]!;

			expect(widget.settings).toEqual({
				range: 'week',
				showProduction: false,
			});
		});

		it('should transform create request with energy widget', (): void => {
			const payloadWithWidget: ISpaceCreateData = {
				name: 'Room with Energy Widget',
				type: SpaceType.ROOM,
				statusWidgets: [
					{
						type: StatusWidgetType.ENERGY,
						order: 0,
						settings: {
							range: EnergyWidgetRange.MONTH,
							showProduction: false,
						},
					},
				],
			};

			const result = transformSpaceCreateRequest(payloadWithWidget);

			expect(result.status_widgets).toEqual([
				{
					type: 'energy',
					order: 0,
					settings: {
						range: 'month',
						show_production: false,
					},
				},
			]);
		});

		it('should apply correct defaults when creating energy widget', (): void => {
			expect(ENERGY_WIDGET_DEFAULTS).toEqual({
				range: EnergyWidgetRange.TODAY,
				showProduction: true,
			});
		});

		it('enabling energy widget creates correct payload with defaults', (): void => {
			const statusWidgets = [
				{
					type: StatusWidgetType.ENERGY,
					order: 0,
					settings: {
						range: ENERGY_WIDGET_DEFAULTS.range,
						showProduction: ENERGY_WIDGET_DEFAULTS.showProduction,
					},
				},
			];

			const payloadWithDefaults: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
				statusWidgets,
			};

			const result = transformSpaceEditRequest(payloadWithDefaults);

			expect((result as Record<string, unknown>).status_widgets).toEqual([
				{
					type: 'energy',
					order: 0,
					settings: {
						range: 'today',
						show_production: true,
					},
				},
			]);
		});

		it('updating range updates payload correctly', (): void => {
			const statusWidgets = [
				{
					type: StatusWidgetType.ENERGY,
					order: 0,
					settings: {
						range: EnergyWidgetRange.WEEK,
						showProduction: true,
					},
				},
			];

			const payload: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
				statusWidgets,
			};

			const result = transformSpaceEditRequest(payload);
			const widgets = (result as Record<string, unknown>).status_widgets as Record<string, unknown>[];

			expect(widgets[0]).toEqual({
				type: 'energy',
				order: 0,
				settings: {
					range: 'week',
					show_production: true,
				},
			});
		});

		it('disabling energy widget removes it from payload', (): void => {
			const payload: ISpaceEditData = {
				name: 'Room',
				type: SpaceType.ROOM,
				statusWidgets: null,
			};

			const result = transformSpaceEditRequest(payload);

			expect((result as Record<string, unknown>).status_widgets).toBeNull();
		});

		it('saving space without touching widget preserves existing config', (): void => {
			// Simulate a response from the API with a widget
			const apiResponse: ApiSpace = {
				...validRoomResponse,
				status_widgets: [
					{
						type: 'energy',
						order: 0,
						settings: {
							range: SpacesModuleEnergyWidgetRange.today,
							show_production: true,
						},
					},
				],
			};

			// Transform to internal format
			const space = transformSpaceResponse(apiResponse);

			// Edit only the name (don't change statusWidgets)
			const editPayload: ISpaceEditData = {
				name: 'Updated Name',
				type: space.type,
				statusWidgets: space.statusWidgets,
			};

			const result = transformSpaceEditRequest(editPayload);

			// Verify the widget config is preserved
			expect((result as Record<string, unknown>).status_widgets).toEqual([
				{
					type: 'energy',
					order: 0,
					settings: {
						range: 'today',
						show_production: true,
					},
				},
			]);
		});
	});
});
