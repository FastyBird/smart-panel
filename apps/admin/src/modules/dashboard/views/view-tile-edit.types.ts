import type { ITile } from '../store/tiles.store.types';

export interface IViewTileEditProps {
	id: ITile['id'];
	tile?: ITile;
	remoteFormChanged?: boolean;
}
