import type { IDataSource, ITile } from '../../../modules/dashboard';
import type { ITilesPage } from '../store/pages.store.types';

export interface IViewPageConfigureProps {
	id: ITilesPage['id'];
	page: ITilesPage;
	tileId?: ITile['id'];
	dataSourceId?: IDataSource['id'];
}
