import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { SpaceCategory, SpaceType } from '../spaces.constants';
import type { ISpace } from '../store/spaces.store.types';

import { useSpace } from './useSpace';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useSpace', () => {
	const spaceId = 'space-1';

	let data: Record<string, ISpace>;
	let semaphore: Ref;
	let get: Mock;
	let edit: Mock;
	let remove: Mock;
	let mockStore: {
		$id: string;
		get: Mock;
		edit: Mock;
		remove: Mock;
		data: Ref;
		semaphore: Ref;
	};

	const createMockSpace = (overrides: Partial<ISpace> = {}): ISpace => ({
		id: spaceId,
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

		data = {
			[spaceId]: createMockSpace(),
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: false,
			},
		});

		get = vi.fn();
		edit = vi.fn();
		remove = vi.fn();

		mockStore = {
			$id: 'spaces',
			get,
			edit,
			remove,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct space by ID', () => {
		const id = ref(spaceId);
		const { space } = useSpace(id);

		expect(space.value).toEqual(data[spaceId]);
	});

	it('should return null if space ID is not found', () => {
		const id = ref('nonexistent');
		const { space } = useSpace(id);

		expect(space.value).toBeNull();
	});

	it('should return null if ID is undefined', () => {
		const id = ref<string | undefined>(undefined);
		const { space } = useSpace(id);

		expect(space.value).toBeNull();
	});

	it('should call get() when fetchSpace is called', async () => {
		const id = ref(spaceId);
		const { fetchSpace } = useSpace(id);

		await fetchSpace();

		expect(get).toHaveBeenCalledWith({ id: spaceId });
	});

	it('should return null from fetchSpace if ID is undefined', async () => {
		const id = ref<string | undefined>(undefined);
		const { fetchSpace } = useSpace(id);

		const result = await fetchSpace();

		expect(result).toBeNull();
		expect(get).not.toHaveBeenCalled();
	});

	it('should call edit() when editSpace is called', async () => {
		const id = ref(spaceId);
		const { editSpace } = useSpace(id);
		const editData = { name: 'Updated Name' };

		await editSpace(editData);

		expect(edit).toHaveBeenCalledWith({ id: spaceId, data: editData });
	});

	it('should throw error if editSpace is called without ID', async () => {
		const id = ref<string | undefined>(undefined);
		const { editSpace } = useSpace(id);

		await expect(editSpace({ name: 'Test' })).rejects.toThrow('Space ID is required');
	});

	it('should call remove() when removeSpace is called', async () => {
		const id = ref(spaceId);
		const { removeSpace } = useSpace(id);

		await removeSpace();

		expect(remove).toHaveBeenCalledWith({ id: spaceId });
	});

	it('should throw error if removeSpace is called without ID', async () => {
		const id = ref<string | undefined>(undefined);
		const { removeSpace } = useSpace(id);

		await expect(removeSpace()).rejects.toThrow('Space ID is required');
	});

	it('should return fetching = true if fetching by ID', () => {
		semaphore.value.fetching.item.push(spaceId);

		const id = ref(spaceId);
		const { fetching } = useSpace(id);

		expect(fetching.value).toBe(true);
	});

	it('should return fetching = false if not fetching', () => {
		const id = ref(spaceId);
		const { fetching } = useSpace(id);

		expect(fetching.value).toBe(false);
	});

	it('should return fetching = false if ID is undefined', () => {
		const id = ref<string | undefined>(undefined);
		const { fetching } = useSpace(id);

		expect(fetching.value).toBe(false);
	});

	it('should react to ID changes', () => {
		const id = ref(spaceId);
		const { space } = useSpace(id);

		expect(space.value).toEqual(data[spaceId]);

		// Add a new space and change the ID
		const newSpaceId = 'space-2';
		data[newSpaceId] = createMockSpace({ id: newSpaceId, name: 'New Space' });
		mockStore.data.value = { ...data };

		id.value = newSpaceId;

		expect(space.value?.id).toBe(newSpaceId);
		expect(space.value?.name).toBe('New Space');
	});
});
