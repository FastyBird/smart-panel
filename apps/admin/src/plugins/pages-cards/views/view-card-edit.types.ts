import type { ICard } from '../store/cards.store.types';
import type { ICardsPage } from '../store/pages.store.types';

export interface IViewCardEditProps {
	pageId: ICardsPage['id'];
	page: ICardsPage;
	id: ICard['id'];
	remoteFormChanged?: boolean;
}
