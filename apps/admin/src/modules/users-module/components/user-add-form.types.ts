import type { FormResultType, UserRole } from '../users.constants';

export interface IUserAddFormFields {
	username: string;
	password: string;
	repeatPassword: string;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	role: UserRole;
}

export interface IUserAddFormProps {
	id: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
