import type { IPage } from '../../../modules/dashboard';

export interface IViewTileAddProps {
	pageId: IPage['id'];
	page: IPage;
	remoteFormChanged?: boolean;
}
