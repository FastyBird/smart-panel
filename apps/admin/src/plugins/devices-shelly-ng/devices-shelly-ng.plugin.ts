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

import { ShellyNgConfigForm, ShellyNgDeviceAddForm, ShellyNgDeviceEditForm } from './components/components';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from './devices-shelly-ng.constants';
import enUS from './locales/en-US.json';
import { ShellyNgConfigEditFormSchema } from './schemas/config.schemas';
import { ShellyNgDeviceAddFormSchema, ShellyNgDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ShellyNgChannelPropertyCreateReqSchema,
	ShellyNgChannelPropertySchema,
	ShellyNgChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ShellyNgChannelCreateReqSchema, ShellyNgChannelSchema, ShellyNgChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ShellyNgConfigSchema, ShellyNgConfigUpdateReqSchema } from './store/config.store.schemas';
import { ShellyNgDeviceCreateReqSchema, ShellyNgDeviceSchema, ShellyNgDeviceUpdateReqSchema } from './store/devices.store.schemas';

export const devicesShellyNgPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesShellyNg');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesShellyNgPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(devicesShellyNgPluginKey, {
			type: DEVICES_SHELLY_NG_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-shelly-ng',
			name: 'Shelly Next Generation Devices',
			description: 'Connect and control your Shelly Next Generation devices directly from the FastyBird Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ShellyNgConfigForm,
					},
					schemas: {
						pluginConfigSchema: ShellyNgConfigSchema,
						pluginConfigEditFormSchema: ShellyNgConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ShellyNgConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_SHELLY_NG_TYPE,
					components: {
						deviceAddForm: ShellyNgDeviceAddForm,
						deviceEditForm: ShellyNgDeviceEditForm,
					},
					schemas: {
						deviceSchema: ShellyNgDeviceSchema,
						deviceAddFormSchema: ShellyNgDeviceAddFormSchema,
						deviceEditFormSchema: ShellyNgDeviceEditFormSchema,
						deviceCreateReqSchema: ShellyNgDeviceCreateReqSchema,
						deviceUpdateReqSchema: ShellyNgDeviceUpdateReqSchema,
						channelSchema: ShellyNgChannelSchema,
						channelCreateReqSchema: ShellyNgChannelCreateReqSchema,
						channelUpdateReqSchema: ShellyNgChannelUpdateReqSchema,
						channelPropertySchema: ShellyNgChannelPropertySchema,
						channelPropertyCreateReqSchema: ShellyNgChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ShellyNgChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
