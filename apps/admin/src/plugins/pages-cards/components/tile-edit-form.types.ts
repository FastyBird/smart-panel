import type { FormResultType, IPage } from '../../../modules/dashboard';

export interface IEditTileProps {
	page: IPage;
	cardId: string;
	id: string;
	remoteFormSubmit: boolean;
	remoteFormResult: FormResultType;
	remoteFormReset: boolean;
	remoteFormChanged: boolean;
}
