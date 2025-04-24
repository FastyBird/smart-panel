import type { IDataSource, IPage } from '../../../modules/dashboard';

export interface IViewDataSourceEditProps {
	pageId: IPage['id'];
	page: IPage;
	id: IDataSource['id'];
	remoteFormChanged?: boolean;
}
