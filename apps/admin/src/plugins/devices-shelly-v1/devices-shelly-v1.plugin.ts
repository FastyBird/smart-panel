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

import { ShellyV1ConfigForm, ShellyV1DeviceAddForm, ShellyV1DeviceEditForm } from './components/components';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_TYPE } from './devices-shelly-v1.constants';
import enUS from './locales/en-US.json';
import { ShellyV1ConfigEditFormSchema } from './schemas/config.schemas';
import { ShellyV1DeviceAddFormSchema, ShellyV1DeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ShellyV1ChannelPropertyCreateReqSchema,
	ShellyV1ChannelPropertySchema,
	ShellyV1ChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ShellyV1ChannelCreateReqSchema, ShellyV1ChannelSchema, ShellyV1ChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ShellyV1ConfigSchema, ShellyV1ConfigUpdateReqSchema } from './store/config.store.schemas';
import { ShellyV1DeviceCreateReqSchema, ShellyV1DeviceSchema, ShellyV1DeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesShellyV1PluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesShellyV1');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesShellyV1Plugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesShellyV1PluginKey, {
			type: DEVICES_SHELLY_V1_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-shelly-v1',
			name: 'Shelly Gen 1',
			description: 'Connect and control your Shelly Gen 1 devices directly from the FastyBird Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ShellyV1ConfigForm,
					},
					schemas: {
						pluginConfigSchema: ShellyV1ConfigSchema,
						pluginConfigEditFormSchema: ShellyV1ConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ShellyV1ConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_SHELLY_V1_TYPE,
					components: {
						deviceAddForm: ShellyV1DeviceAddForm,
						deviceEditForm: ShellyV1DeviceEditForm,
					},
					schemas: {
						deviceSchema: ShellyV1DeviceSchema,
						deviceAddFormSchema: ShellyV1DeviceAddFormSchema,
						deviceEditFormSchema: ShellyV1DeviceEditFormSchema,
						deviceCreateReqSchema: ShellyV1DeviceCreateReqSchema,
						deviceUpdateReqSchema: ShellyV1DeviceUpdateReqSchema,
						channelSchema: ShellyV1ChannelSchema,
						channelCreateReqSchema: ShellyV1ChannelCreateReqSchema,
						channelUpdateReqSchema: ShellyV1ChannelUpdateReqSchema,
						channelPropertySchema: ShellyV1ChannelPropertySchema,
						channelPropertyCreateReqSchema: ShellyV1ChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ShellyV1ChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
