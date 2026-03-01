import type { IDataSource, ITile } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';
import type { ICardsPage } from '../store/pages.store.types';

export interface IViewPageConfigureProps {
	id: ICardsPage['id'];
	page: ICardsPage;
	tileId?: ITile['id'];
	cardId?: ICard['id'];
	dataSourceId?: IDataSource['id'];
}
