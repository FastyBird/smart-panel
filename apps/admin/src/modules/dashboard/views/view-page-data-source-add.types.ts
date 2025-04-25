import type { IPage } from '../store/pages.store.types';

export interface IViewPageDataSourceAddProps {
	pageId: IPage['id'];
	page: IPage;
	remoteFormChanged?: boolean;
}
