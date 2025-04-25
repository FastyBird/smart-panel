import type { FormResultType, LayoutType } from '../config.constants';
import type { IConfigWeather } from '../store/config-weather.store.types';

export type IConfigWeatherFormProps = {
	config: IConfigWeather;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	layout?: LayoutType;
};
