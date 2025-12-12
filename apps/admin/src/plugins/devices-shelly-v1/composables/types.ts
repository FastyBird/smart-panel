import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IShellyV1DeviceAddForm, IShellyV1DeviceEditForm, IShellyV1DeviceInfo, IShellyV1SupportedDevice } from '../schemas/devices.types';

export interface IUseDeviceAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	activeStep: Ref<'one' | 'two'>;
	supportedDevices: Ref<IShellyV1SupportedDevice[]>;
	model: Reactive<IShellyV1DeviceAddForm>;
	stepOneFormEl: Ref<FormInstance | undefined>;
	stepTwoFormEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	deviceInfo: Ref<IShellyV1DeviceInfo | null>;
	submitStep: (step: 'one' | 'two') => Promise<'ok' | 'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	supportedDevices: Ref<IShellyV1SupportedDevice[]>;
	model: Reactive<IShellyV1DeviceEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseSupportedDevices {
	supportedDevices: Ref<IShellyV1SupportedDevice[]>;
	loaded: Ref<boolean>;
	fetchDevices: (force?: boolean) => Promise<void>;
}
