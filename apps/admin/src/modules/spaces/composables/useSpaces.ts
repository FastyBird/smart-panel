import { type ComputedRef, computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { SpaceType, isFloorZoneCategory } from '../spaces.constants';
import { type ISpace, spacesStoreKey } from '../store';

interface IUseSpaces {
	spaces: ComputedRef<ISpace[]>;
	roomSpaces: ComputedRef<ISpace[]>;
	zoneSpaces: ComputedRef<ISpace[]>;
	floorZoneSpaces: ComputedRef<ISpace[]>;
	fetching: ComputedRef<boolean>;
	// Only the read of the whole collection, not of a single space
	fetchingSpaces: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
	findById: (id: ISpace['id']) => ISpace | null;
}

export const useSpaces = (): IUseSpaces => {
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { firstLoad } = storeToRefs(spacesStore);

	const spaces = computed<ISpace[]>(() => spacesStore.findAll());

	const roomSpaces = computed<ISpace[]>(() => spacesStore.findAll().filter((space) => space.type === SpaceType.ROOM));

	const zoneSpaces = computed<ISpace[]>(() => spacesStore.findAll().filter((space) => space.type === SpaceType.ZONE));

	const floorZoneSpaces = computed<ISpace[]>(() =>
		spacesStore.findAll().filter((space) => space.type === SpaceType.ZONE && isFloorZoneCategory(space.category))
	);

	const fetching = computed<boolean>(() => spacesStore.fetching());

	const fetchingSpaces = computed<boolean>(() => spacesStore.semaphore.fetching.items);

	const firstLoadFinished = computed<boolean>(() => firstLoad.value);

	const fetchSpaces = async (): Promise<ISpace[]> => {
		return spacesStore.fetch();
	};

	const findById = (id: ISpace['id']): ISpace | null => {
		return spacesStore.findById(id);
	};

	return {
		spaces,
		roomSpaces,
		zoneSpaces,
		floorZoneSpaces,
		fetching,
		fetchingSpaces,
		firstLoadFinished,
		fetchSpaces,
		findById,
	};
};
