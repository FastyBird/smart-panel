import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { isFloorZoneCategory, SpaceType } from '../spaces.constants';
import { spacesStoreKey, type ISpace } from '../store';

interface IUseSpaces {
	spaces: ComputedRef<ISpace[]>;
	roomSpaces: ComputedRef<ISpace[]>;
	zoneSpaces: ComputedRef<ISpace[]>;
	floorZoneSpaces: ComputedRef<ISpace[]>;
	fetching: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
	findById: (id: ISpace['id']) => ISpace | null;
}

export const useSpaces = (): IUseSpaces => {
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { firstLoad } = storeToRefs(spacesStore);

	const spaces = computed<ISpace[]>(() => spacesStore.findAll());

	const roomSpaces = computed<ISpace[]>(() =>
		spacesStore.findAll().filter((space) => space.type === SpaceType.ROOM)
	);

	const zoneSpaces = computed<ISpace[]>(() =>
		spacesStore.findAll().filter((space) => space.type === SpaceType.ZONE)
	);

	const floorZoneSpaces = computed<ISpace[]>(() =>
		spacesStore.findAll().filter((space) =>
			space.type === SpaceType.ZONE && isFloorZoneCategory(space.category)
		)
	);

	const fetching = computed<boolean>(() => spacesStore.fetching());

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
		firstLoadFinished,
		fetchSpaces,
		findById,
	};
};
