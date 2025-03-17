import type { IUser } from '../store';
import type { FormResultType, UserRole } from '../users.constants';

export interface IUserEditFormFields {
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	role?: UserRole;
}

export interface IUserEditFormProps {
	user: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
