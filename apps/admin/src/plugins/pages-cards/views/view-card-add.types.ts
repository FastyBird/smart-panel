import type { ICardsPage } from '../store/pages.store.types';

export interface IViewCardAddProps {
	pageId: ICardsPage['id'];
	page: ICardsPage;
	remoteFormChanged?: boolean;
}
