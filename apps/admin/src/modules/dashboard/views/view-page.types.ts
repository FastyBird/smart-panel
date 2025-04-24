import type { IDataSource } from '../store/data-sources.store.types';
import type { IPage } from '../store/pages.store.types';
import type { ITile } from '../store/tiles.store.types';

export interface IViewPageProps {
	id: IPage['id'];
	tileId?: ITile['id'];
	dataSourceId?: IDataSource['id'];
	elementType?: string;
	elementId?: string;
}
