import type { ITile } from '../store/tiles.store.types';

export interface IViewTileDataSourceAddProps {
	tileId: ITile['id'];
	tile: ITile;
	remoteFormChanged?: boolean;
}
