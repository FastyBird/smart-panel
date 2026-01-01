import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { SpaceCategory, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import { useSpaces } from './useSpaces';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useSpaces', () => {
	let mockData: ISpace[];
	let firstLoad: Ref;
	let fetch: Mock;
	let findAll: Mock;
	let findById: Mock;
	let fetching: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findAll: Mock;
		findById: Mock;
		fetching: Mock;
		firstLoad: Ref;
	};

	const createMockSpace = (overrides: Partial<ISpace> = {}): ISpace => ({
		id: 'space-1',
		name: 'Test Space',
		description: null,
		type: SpaceType.ROOM,
		category: SpaceCategory.LIVING_ROOM,
		icon: null,
		displayOrder: 0,
		parentId: null,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		suggestionsEnabled: true,
		createdAt: new Date(),
		updatedAt: null,
		draft: false,
		...overrides,
	});

	beforeEach(() => {
		setActivePinia(createPinia());

		mockData = [
			createMockSpace({ id: 'room-1', name: 'Living Room', type: SpaceType.ROOM }),
			createMockSpace({ id: 'room-2', name: 'Bedroom', type: SpaceType.ROOM, draft: true }),
			createMockSpace({ id: 'zone-1', name: 'Ground Floor', type: SpaceType.ZONE, category: SpaceCategory.FLOOR_GROUND }),
			createMockSpace({ id: 'zone-2', name: 'First Floor', type: SpaceType.ZONE, category: SpaceCategory.FLOOR_FIRST }),
			createMockSpace({ id: 'zone-3', name: 'Backyard', type: SpaceType.ZONE, category: SpaceCategory.OUTDOOR_BACKYARD }),
		];

		firstLoad = ref(false);
		fetch = vi.fn();
		findAll = vi.fn(() => mockData);
		findById = vi.fn((id: string) => mockData.find((s) => s.id === id) ?? null);
		fetching = vi.fn(() => false);

		mockStore = {
			$id: 'spaces',
			fetch,
			findAll,
			findById,
			fetching,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return all spaces', () => {
		const { spaces } = useSpaces();

		expect(spaces.value).toHaveLength(5);
	});

	it('should return only room spaces', () => {
		const { roomSpaces } = useSpaces();

		expect(roomSpaces.value).toHaveLength(2);
		expect(roomSpaces.value.every((s) => s.type === SpaceType.ROOM)).toBe(true);
	});

	it('should return only zone spaces', () => {
		const { zoneSpaces } = useSpaces();

		expect(zoneSpaces.value).toHaveLength(3);
		expect(zoneSpaces.value.every((s) => s.type === SpaceType.ZONE)).toBe(true);
	});

	it('should return only floor zone spaces', () => {
		const { floorZoneSpaces } = useSpaces();

		// Ground Floor and First Floor are floor zones, Backyard is not
		expect(floorZoneSpaces.value).toHaveLength(2);
		expect(floorZoneSpaces.value.map((s) => s.name)).toContain('Ground Floor');
		expect(floorZoneSpaces.value.map((s) => s.name)).toContain('First Floor');
		expect(floorZoneSpaces.value.map((s) => s.name)).not.toContain('Backyard');
	});

	it('should call fetchSpaces', async () => {
		const { fetchSpaces } = useSpaces();

		await fetchSpaces();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return fetching = true if store is fetching', () => {
		fetching.mockReturnValue(true);

		const { fetching: isFetching } = useSpaces();

		expect(isFetching.value).toBe(true);
	});

	it('should return fetching = false if store is not fetching', () => {
		fetching.mockReturnValue(false);

		const { fetching: isFetching } = useSpaces();

		expect(isFetching.value).toBe(false);
	});

	it('should return firstLoadFinished = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { firstLoadFinished } = useSpaces();

		expect(firstLoadFinished.value).toBe(true);
	});

	it('should return firstLoadFinished = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { firstLoadFinished } = useSpaces();

		expect(firstLoadFinished.value).toBe(false);
	});

	it('should find space by id', () => {
		const { findById: find } = useSpaces();

		const result = find('room-1');

		expect(result).not.toBeNull();
		expect(result?.name).toBe('Living Room');
		expect(findById).toHaveBeenCalledWith('room-1');
	});

	it('should return null for non-existent space id', () => {
		const { findById: find } = useSpaces();

		const result = find('non-existent');

		expect(result).toBeNull();
	});
});
