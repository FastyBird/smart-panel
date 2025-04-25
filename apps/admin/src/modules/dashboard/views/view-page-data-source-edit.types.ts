import type { IDataSource } from '../store/data-sources.store.types';
import type { IPage } from '../store/pages.store.types';

export interface IViewPageDataSourceEditProps {
	pageId: IPage['id'];
	page: IPage;
	id: IDataSource['id'];
	remoteFormChanged?: boolean;
}
