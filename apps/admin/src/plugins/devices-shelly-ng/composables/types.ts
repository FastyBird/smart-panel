import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import type { IShellyNgDeviceAddForm, IShellyNgDeviceEditForm, IShellyNgDeviceInfo, IShellyNgSupportedDevice } from '../schemas/devices.types';

export interface IUseDeviceAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	activeStep: Ref<'one' | 'two'>;
	supportedDevices: Ref<IShellyNgSupportedDevice[]>;
	model: Reactive<IShellyNgDeviceAddForm>;
	stepOneFormEl: Ref<FormInstance | undefined>;
	stepTwoFormEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	deviceInfo: Ref<IShellyNgDeviceInfo | null>;
	submitStep: (step: 'one' | 'two') => Promise<'ok' | 'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	supportedDevices: Ref<IShellyNgSupportedDevice[]>;
	model: Reactive<IShellyNgDeviceEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseSupportedDevices {
	supportedDevices: Ref<IShellyNgSupportedDevice[]>;
	loaded: Ref<boolean>;
	fetchDevices: () => Promise<void>;
}
