import type { FormResultType } from '../auth.constants';

export type ViewProfileGeneralProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
