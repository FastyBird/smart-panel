import type { FormResultType } from '../../../modules/dashboard';
import type { ICardsPage } from '../store/pages.store.types';

export interface ICardAddFormProps {
	id: string;
	page: ICardsPage;
	remoteFormSubmit: boolean;
	remoteFormResult: FormResultType;
	remoteFormReset: boolean;
	remoteFormChanged: boolean;
}
