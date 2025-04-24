import type { IDataSource } from '../store/data-sources.store.types';
import type { ITile } from '../store/tiles.store.types';

export interface IViewTileProps {
	id: ITile['id'];
	dataSourceId?: IDataSource['id'];
}
