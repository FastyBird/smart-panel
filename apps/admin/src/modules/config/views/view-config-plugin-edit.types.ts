import { FormResult } from '../config.constants';

export interface IViewConfigPluginEditProps {
	plugin: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResult;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
