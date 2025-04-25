import type { IPage } from '../../../modules/dashboard';

export interface IViewDataSourceAddProps {
	pageId: IPage['id'];
	page: IPage;
	remoteFormChanged?: boolean;
}
