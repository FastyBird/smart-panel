import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType, IDevice } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IShellyV1DeviceAddForm, IShellyV1DeviceEditForm, IShellyV1DeviceInfo, IShellyV1SupportedDevice } from '../schemas/devices.types';

export interface IUseDeviceAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	supportedDevices: Ref<IShellyV1SupportedDevice[]>;
	/** The supported devices list has arrived */
	supportedDevicesLoaded: Ref<boolean>;
	loadSupportedDevices: () => Promise<void>;
	/** A device of this plugin that is in Smart Panel already, hidden ones included */
	findRegistered: (info: IShellyV1DeviceInfo) => IDevice | undefined;
	model: Reactive<IShellyV1DeviceAddForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	deviceInfo: Ref<IShellyV1DeviceInfo | null>;
	/** Reads the device at the hostname; rejects with the reason it could not */
	checkDevice: () => Promise<IShellyV1DeviceInfo>;
	/** Checks the device first when it was not tested, then adds it */
	submit: () => Promise<'added'>;
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
