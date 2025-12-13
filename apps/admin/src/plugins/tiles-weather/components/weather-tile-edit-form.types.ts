import type { FormResultType } from '../../../modules/dashboard';
import type { IDayWeatherTile, IForecastWeatherTile } from '../store/tiles.store.types';

export interface IWeatherTileEditFormProps {
	tile: IDayWeatherTile | IForecastWeatherTile;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
	onlyDraft?: boolean;
	withPosition?: boolean;
	withSize?: boolean;
}

export const weatherTileEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};
