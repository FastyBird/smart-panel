import type { FormResultType } from '../../../modules/dashboard';
import type { ITile } from '../../../modules/dashboard/store/tiles.store.types';

export interface IWeatherTileAddFormProps {
	id: ITile['id'];
	type: string;
	parent: string;
	parentId: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	onlyDraft?: boolean;
	withPosition?: boolean;
	withSize?: boolean;
}
