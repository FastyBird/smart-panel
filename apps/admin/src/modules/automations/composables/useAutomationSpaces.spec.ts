import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceType } from '../../spaces/spaces.constants';
import type { ISpace } from '../../spaces/store/spaces.store.types';

import { useAutomationSpaces } from './useAutomationSpaces';

const spaces = ref<ISpace[]>([]);
const fetching = ref<boolean>(false);
const firstLoadFinished = ref<boolean>(false);
const fetchSpaces = vi.fn();

vi.mock('../../spaces/composables', () => ({
	useSpaces: () => ({
		spaces: computed(() => spaces.value),
		fetching: computed(() => fetching.value),
		firstLoadFinished: computed(() => firstLoadFinished.value),
		fetchSpaces,
		findById: (id: string): ISpace | null => spaces.value.find((space) => space.id === id) ?? null,
	}),
}));

const space = (id: string, name: string, type: SpaceType, icon: string | null = null): ISpace => ({ id, name, type, icon, category: null }) as ISpace;

describe('useAutomationSpaces', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		spaces.value = [
			space('z1', 'Upstairs', SpaceType.ZONE),
			space('r2', 'Kitchen', SpaceType.ROOM, 'mdi:silverware'),
			space('r1', 'Bathroom', SpaceType.ROOM),
		];
		fetching.value = false;
		firstLoadFinished.value = false;
	});

	it('lists rooms before zones, each sorted by name', () => {
		const { spacesOptions } = useAutomationSpaces();

		expect(spacesOptions.value).toEqual([
			{ value: 'r1', label: 'Bathroom', icon: 'mdi:door' },
			{ value: 'r2', label: 'Kitchen', icon: 'mdi:silverware' },
			{ value: 'z1', label: 'Upstairs', icon: 'mdi:map-marker-radius' },
		]);
	});

	it('resolves the name of a space', () => {
		const { getSpaceName } = useAutomationSpaces();

		expect(getSpaceName('r2')).toBe('Kitchen');
		expect(getSpaceName('unknown')).toBeNull();
		expect(getSpaceName(null)).toBeNull();
	});

	it('fetches the spaces only when they were not loaded yet', async () => {
		const { fetchSpaces: fetch } = useAutomationSpaces();

		await fetch();

		expect(fetchSpaces).toHaveBeenCalledTimes(1);

		firstLoadFinished.value = true;

		await fetch();

		expect(fetchSpaces).toHaveBeenCalledTimes(1);
	});

	it('follows the loading state of the spaces', () => {
		const { loadingSpaces } = useAutomationSpaces();

		expect(loadingSpaces.value).toBe(false);

		fetching.value = true;

		expect(loadingSpaces.value).toBe(true);
	});
});
