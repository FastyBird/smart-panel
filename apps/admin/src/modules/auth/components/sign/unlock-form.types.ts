import type { FormResultType } from '../../auth.constants';

export type UnlockFormFields = {
	password: string;
};

export type UnlockFormProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
