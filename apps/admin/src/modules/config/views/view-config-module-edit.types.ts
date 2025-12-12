import { FormResult } from '../config.constants';

export interface IViewConfigModuleEditProps {
	module: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResult;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
