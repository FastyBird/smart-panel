import type { FormResultType, LayoutType } from '../config.constants';

export type IConfigModuleProps = {
	type: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	layout?: LayoutType;
};

