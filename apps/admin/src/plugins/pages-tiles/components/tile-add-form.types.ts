import type { FormResultType, IPage, ITile } from '../../../modules/dashboard';

export interface IAddTileProps {
	id: ITile['id'];
	page: IPage;
	remoteFormSubmit: boolean;
	remoteFormResult: FormResultType;
	remoteFormReset: boolean;
	remoteFormChanged: boolean;
}
