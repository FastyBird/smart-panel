import type { IDataSource, IPage, ITile } from '../../../modules/dashboard';

export interface IViewPageConfigureProps {
	id: IPage['id'];
	page: IPage;
	tileId?: ITile['id'];
	dataSourceId?: IDataSource['id'];
}
