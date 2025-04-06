import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigAudio } from '../store/config-audio.store.types';

export type IConfigAudioFormProps = {
	config: IConfigAudio;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};
