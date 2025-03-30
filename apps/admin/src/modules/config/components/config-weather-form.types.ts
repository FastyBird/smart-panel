import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigWeather } from '../store';

export type ConfigWeatherFormProps = {
	config: IConfigWeather;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};
