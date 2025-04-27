/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { FormResultType } from './config.constants';
import type { ConfigPluginEditFormSchema } from './schemas/plugins.schemas';
import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from './store/config-plugins.store.schemas';
import type { IConfigPlugin } from './store/config-plugins.store.types';

export interface IPluginConfigEditFormProps {
	config: IConfigPlugin;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	remoteFormChanged?: boolean;
}

export const pluginConfigEditFormEmits = {
	'update:remote-form-submit': (remoteFormSubmit: boolean): boolean => typeof remoteFormSubmit === 'boolean',
	'update:remote-form-result': (remoteFormResult: FormResultType): boolean => typeof remoteFormResult === 'string',
	'update:remote-form-reset': (remoteFormReset: boolean): boolean => typeof remoteFormReset === 'boolean',
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};

export type IPluginsComponents = {
	pluginConfigEditForm?: DefineComponent<
		IPluginConfigEditFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof pluginConfigEditFormEmits
	>;
};

export type IPluginsSchemas = {
	pluginConfigSchema?: typeof ConfigPluginSchema;
	pluginConfigEditFormSchema?: typeof ConfigPluginEditFormSchema;
	pluginConfigUpdateReqSchema?: typeof ConfigPluginUpdateReqSchema;
};
