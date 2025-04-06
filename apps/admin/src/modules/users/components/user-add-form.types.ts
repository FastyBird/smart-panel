import type { IUser } from '../store/users.store.types';
import type { FormResultType } from '../users.constants';

export interface IUserAddFormProps {
	id: IUser['id'];
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
