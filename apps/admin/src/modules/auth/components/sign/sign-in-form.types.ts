import type { FormResultType } from '../../auth.constants';

export type SignInFormFields = {
	username: string;
	password: string;
};

export type SignInFormProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
