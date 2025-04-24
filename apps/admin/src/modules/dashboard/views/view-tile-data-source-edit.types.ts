import type { ITile } from '../store/tiles.store.types';

export interface IViewTileDataSourceEditProps {
	tileId: ITile['id'];
	tile: ITile;
	id: string;
	remoteFormChanged?: boolean;
}
