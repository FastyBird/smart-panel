import { injectStoresManager } from '../../../common';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';

/** Names for a review summary: the chosen room and zones, or a dash when nothing is chosen. */
export function usePlacementNames() {
	const spacesStore = injectStoresManager().getStore(spacesStoreKey);
	const nameOf = (id: string): string => spacesStore.findAll().find((space) => space.id === id)?.name ?? id;

	return {
		roomName: (roomId: string | null): string => (roomId ? nameOf(roomId) : '—'),
		zoneNames: (zoneIds: string[]): string => (zoneIds.length ? zoneIds.map(nameOf).join(', ') : '—'),
	};
}
