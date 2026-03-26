import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { ReTerminalConfigForm, ReTerminalDeviceAddForm, ReTerminalDeviceEditForm } from './components/components';
import { DEVICES_RETERMINAL_PLUGIN_NAME, DEVICES_RETERMINAL_TYPE } from './devices-reterminal.constants';
import { locales } from './locales';
import { ReTerminalConfigEditFormSchema } from './schemas/config.schemas';
import { ReTerminalDeviceAddFormSchema, ReTerminalDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ReTerminalChannelPropertyCreateReqSchema,
	ReTerminalChannelPropertySchema,
	ReTerminalChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ReTerminalChannelCreateReqSchema, ReTerminalChannelSchema, ReTerminalChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ReTerminalConfigSchema, ReTerminalConfigUpdateReqSchema } from './store/config.store.schemas';
import { ReTerminalDeviceCreateReqSchema, ReTerminalDeviceSchema, ReTerminalDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesReTerminalPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesReTerminal');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesReTerminalPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesReTerminalPluginKey, {
			type: DEVICES_RETERMINAL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-reterminal',
			name: 'reTerminal',
			description: 'SeeedStudio reTerminal host device hardware peripherals plugin',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ReTerminalConfigForm,
					},
					schemas: {
						pluginConfigSchema: ReTerminalConfigSchema,
						pluginConfigEditFormSchema: ReTerminalConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ReTerminalConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_RETERMINAL_TYPE,
					components: {
						deviceAddForm: ReTerminalDeviceAddForm,
						deviceEditForm: ReTerminalDeviceEditForm,
					},
					schemas: {
						deviceSchema: ReTerminalDeviceSchema,
						deviceAddFormSchema: ReTerminalDeviceAddFormSchema,
						deviceEditFormSchema: ReTerminalDeviceEditFormSchema,
						deviceCreateReqSchema: ReTerminalDeviceCreateReqSchema,
						deviceUpdateReqSchema: ReTerminalDeviceUpdateReqSchema,
						channelSchema: ReTerminalChannelSchema,
						channelCreateReqSchema: ReTerminalChannelCreateReqSchema,
						channelUpdateReqSchema: ReTerminalChannelUpdateReqSchema,
						channelPropertySchema: ReTerminalChannelPropertySchema,
						channelPropertyCreateReqSchema: ReTerminalChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ReTerminalChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
