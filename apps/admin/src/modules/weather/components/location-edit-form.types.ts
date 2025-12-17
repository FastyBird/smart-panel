import type { IWeatherLocation } from '../store/locations.store.types';
import type { FormResultType } from '../weather.constants';

export interface ILocationEditFormProps {
	location: IWeatherLocation;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const locationEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};
