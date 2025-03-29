/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import { type IDeviceAddFormProps, type IDeviceEditFormProps, deviceAddFormEmits, deviceEditFormEmits } from './components';
import DevicesModule from './devices.module';
import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from './store';

// Module
export { DevicesModule };

export * from './store';
export * from './devices.constants';
export * from './devices.exceptions';

export type IPluginsComponents = {
	deviceAddForm?: DefineComponent<IDeviceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceAddFormEmits>;
	deviceEditForm?: DefineComponent<IDeviceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceEditFormEmits>;
};

export type IPluginsSchemas = {
	deviceSchema?: typeof DeviceSchema;
	deviceCreateReqSchema?: typeof DeviceCreateReqSchema;
	deviceUpdateReqSchema?: typeof DeviceUpdateReqSchema;
	deviceResSchema?: typeof DeviceResSchema;
};
