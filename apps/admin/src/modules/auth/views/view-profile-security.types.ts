import type { FormResultType } from '../auth.constants';

export type ViewProfileSecurityProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
