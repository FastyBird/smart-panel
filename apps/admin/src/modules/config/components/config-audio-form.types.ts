import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigAudio } from '../store';

export type ConfigAudioFormProps = {
	config: IConfigAudio;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};
