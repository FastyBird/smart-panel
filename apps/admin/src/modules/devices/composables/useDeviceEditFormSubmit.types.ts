import type { Reactive } from 'vue';

import type { IDeviceEditForm } from '../schemas/devices.types';
import type { IDevice } from '../store/devices.store.types';

export interface IUseDeviceEditFormSubmitProps<TForm extends IDeviceEditForm, TData extends IDeviceEditForm> {
	device: IDevice;
	model: Reactive<TForm>;
	messages?: { success?: string; error?: string };
	messagePrefix: string;
	parseModel: () => { success: true; data: TData } | { success: false; error: unknown };
	validationException: new (message: string) => Error;
	prepareData?: (data: TData, initialModel: Reactive<TForm>) => IDeviceEditForm;
}
