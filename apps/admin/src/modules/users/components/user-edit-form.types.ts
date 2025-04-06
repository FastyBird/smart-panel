import type { IUser } from '../store/users.store.types';
import type { FormResultType } from '../users.constants';

export interface IUserEditFormProps {
	user: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
