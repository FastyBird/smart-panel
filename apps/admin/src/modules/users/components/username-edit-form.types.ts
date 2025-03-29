import type { IUser } from '../store';
import type { FormResultType } from '../users.constants';

export interface IUsernameEditFormProps {
	user: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
}
