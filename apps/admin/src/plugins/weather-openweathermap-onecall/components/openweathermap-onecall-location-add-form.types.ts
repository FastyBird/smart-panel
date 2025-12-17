import type { IWeatherLocation } from '../../../modules/weather/store/locations.store.types';
import type { FormResultType } from '../../../modules/weather';

export interface IOpenWeatherMapOneCallLocationAddFormProps {
	id: IWeatherLocation['id'];
	type: string;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}
