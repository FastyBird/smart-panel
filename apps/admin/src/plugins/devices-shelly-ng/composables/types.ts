import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IShellyNgDeviceAddForm, IShellyNgDeviceEditForm, IShellyNgDeviceInfo, IShellyNgSupportedDevice } from '../schemas/devices.types';

export interface IUseDeviceAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	supportedDevices: Ref<IShellyNgSupportedDevice[]>;
	/** The supported devices list has arrived */
	supportedDevicesLoaded: Ref<boolean>;
	loadSupportedDevices: () => Promise<void>;
	model: Reactive<IShellyNgDeviceAddForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	deviceInfo: Ref<IShellyNgDeviceInfo | null>;
	/** Reads the device at the hostname; rejects with the reason it could not */
	checkDevice: () => Promise<IShellyNgDeviceInfo>;
	/** Checks the device first when it was not tested, then adds it */
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	hasEthernet: ComputedRef<boolean>;
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
	fetchDevices: (force?: boolean) => Promise<void>;
}
