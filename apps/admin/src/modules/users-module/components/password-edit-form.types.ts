import type { IUser } from '../store';
import type { FormResultType } from '../users.constants';

export interface IPasswordEditFormFields {
	password: string;
	repeatPassword: string;
}

export interface IPasswordEditFormProps {
	user: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
}
