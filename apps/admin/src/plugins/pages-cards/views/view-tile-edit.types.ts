import type { IPage, ITile } from '../../../modules/dashboard';

export interface IViewTileEditProps {
	pageId: IPage['id'];
	page: IPage;
	cardId: string;
	id: ITile['id'];
	remoteFormChanged?: boolean;
}
