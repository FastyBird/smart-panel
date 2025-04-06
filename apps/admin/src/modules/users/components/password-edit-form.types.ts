import type { IUser } from '../store/users.store.types';
import type { FormResultType } from '../users.constants';

export interface IPasswordEditFormProps {
	user: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
}
