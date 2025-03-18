import type { FormResultType } from '../../auth.constants';

export type SignUpFormFields = {
	username: string;
	password: string;
	email: string;
	firstName: string;
	lastName: string;
};

export type SignUpFormProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
