import type { FormResultType } from '../config.constants';

export type ViewConfigPluginsProps = {
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
};
