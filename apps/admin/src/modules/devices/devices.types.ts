/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import { type IDeviceAddFormProps, deviceAddFormEmits } from './components/devices/device-add-form.types';
import { type IDeviceEditFormProps, deviceEditFormEmits } from './components/devices/device-edit-form.types';
import { DeviceCreateReqSchema, DeviceSchema, DeviceUpdateReqSchema } from './store/devices.store.schemas';

export type IPluginsComponents = {
	deviceAddForm?: DefineComponent<IDeviceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceAddFormEmits>;
	deviceEditForm?: DefineComponent<IDeviceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceEditFormEmits>;
};

export type IPluginsSchemas = {
	deviceSchema?: typeof DeviceSchema;
	deviceCreateReqSchema?: typeof DeviceCreateReqSchema;
	deviceUpdateReqSchema?: typeof DeviceUpdateReqSchema;
};
