import { computed } from 'vue';

import { useSpaces } from '../../spaces/composables';
import { SpaceType, getSpaceIcon } from '../../spaces/spaces.constants';
import type { ISpace } from '../../spaces/store/spaces.store.types';

import type { ISpaceOption, IUseAutomationSpaces } from './types';

/**
 * The spaces an automation can belong to: rooms first, then zones, each sorted by name.
 */
export const useAutomationSpaces = (): IUseAutomationSpaces => {
	const { spaces, fetching, firstLoadFinished, fetchSpaces: fetchAllSpaces, findById } = useSpaces();

	const toOptions = (type: SpaceType): ISpaceOption[] => {
		return spaces.value
			.filter((space) => space.type === type)
			.map((space) => ({
				value: space.id,
				label: space.name,
				icon: getSpaceIcon(space),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	};

	const spacesOptions = computed<ISpaceOption[]>((): ISpaceOption[] => [...toOptions(SpaceType.ROOM), ...toOptions(SpaceType.ZONE)]);

	const loadingSpaces = computed<boolean>((): boolean => fetching.value);

	const fetchSpaces = async (): Promise<void> => {
		if (firstLoadFinished.value) {
			return;
		}

		await fetchAllSpaces();
	};

	const getSpaceName = (id: ISpace['id'] | null): string | null => {
		return id === null ? null : (findById(id)?.name ?? null);
	};

	return {
		spacesOptions,
		loadingSpaces,
		fetchSpaces,
		getSpaceName,
	};
};
