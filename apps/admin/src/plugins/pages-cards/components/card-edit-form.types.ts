import type { FormResultType } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';
import type { ICardsPage } from '../store/pages.store.types';

export interface ICardEditFormProps {
	page: ICardsPage;
	card: ICard;
	remoteFormSubmit: boolean;
	remoteFormResult: FormResultType;
	remoteFormReset: boolean;
	remoteFormChanged: boolean;
}
