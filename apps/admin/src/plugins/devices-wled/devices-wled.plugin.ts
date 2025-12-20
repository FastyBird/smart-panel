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

import { WledConfigForm, WledDeviceAddForm, WledDeviceEditForm } from './components/components';
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_TYPE } from './devices-wled.constants';
import enUS from './locales/en-US.json';
import { WledConfigEditFormSchema } from './schemas/config.schemas';
import { WledDeviceAddFormSchema, WledDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	WledChannelPropertyCreateReqSchema,
	WledChannelPropertySchema,
	WledChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { WledChannelCreateReqSchema, WledChannelSchema, WledChannelUpdateReqSchema } from './store/channels.store.schemas';
import { WledConfigSchema, WledConfigUpdateReqSchema } from './store/config.store.schemas';
import { WledDeviceCreateReqSchema, WledDeviceSchema, WledDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesWledPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesWled');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesWledPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesWledPluginKey, {
			type: DEVICES_WLED_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-wled',
			name: 'WLED Devices',
			description: 'Connect and control your WLED addressable LED controllers from the FastyBird Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: WledConfigForm,
					},
					schemas: {
						pluginConfigSchema: WledConfigSchema,
						pluginConfigEditFormSchema: WledConfigEditFormSchema,
						pluginConfigUpdateReqSchema: WledConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_WLED_TYPE,
					components: {
						deviceAddForm: WledDeviceAddForm,
						deviceEditForm: WledDeviceEditForm,
					},
					schemas: {
						deviceSchema: WledDeviceSchema,
						deviceAddFormSchema: WledDeviceAddFormSchema,
						deviceEditFormSchema: WledDeviceEditFormSchema,
						deviceCreateReqSchema: WledDeviceCreateReqSchema,
						deviceUpdateReqSchema: WledDeviceUpdateReqSchema,
						channelSchema: WledChannelSchema,
						channelCreateReqSchema: WledChannelCreateReqSchema,
						channelUpdateReqSchema: WledChannelUpdateReqSchema,
						channelPropertySchema: WledChannelPropertySchema,
						channelPropertyCreateReqSchema: WledChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: WledChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
