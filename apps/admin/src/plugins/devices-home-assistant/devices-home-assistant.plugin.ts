import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
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

import {
	HomeAssistantChannelPropertyAddForm,
	HomeAssistantChannelPropertyEditForm,
	HomeAssistantConfigForm,
	HomeAssistantDeviceAddForm,
	HomeAssistantDeviceEditForm,
} from './components/components';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from './devices-home-assistant.constants';
import enUS from './locales/en-US.json';
import { HomeAssistantChannelPropertyAddFormSchema, HomeAssistantChannelPropertyEditFormSchema } from './schemas/channels.properties.schemas';
import { HomeAssistantConfigEditFormSchema } from './schemas/config.schemas';
import { HomeAssistantDeviceAddFormSchema, HomeAssistantDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	HomeAssistantChannelPropertyCreateReqSchema,
	HomeAssistantChannelPropertySchema,
	HomeAssistantChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { HomeAssistantChannelCreateReqSchema, HomeAssistantChannelSchema, HomeAssistantChannelUpdateReqSchema } from './store/channels.store.schemas';
import { HomeAssistantConfigSchema, HomeAssistantConfigUpdateReqSchema } from './store/config.store.schemas';
import { HomeAssistantDeviceCreateReqSchema, HomeAssistantDeviceSchema, HomeAssistantDeviceUpdateReqSchema } from './store/devices.store.schemas';
import {
	discoveredDevicesStoreKey,
	registerHomeAssistantDiscoveredDevicesStore,
	registerHomeAssistantStatesStore,
	statesStoreKey,
} from './store/stores';

export const devicesHomeAssistantPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesHomeAssistant');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesHomeAssistantPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const discoveredDevicesStore = registerHomeAssistantDiscoveredDevicesStore(options.store);

		app.provide(discoveredDevicesStoreKey, discoveredDevicesStore);
		storesManager.addStore(discoveredDevicesStoreKey, discoveredDevicesStore);

		const statesStore = registerHomeAssistantStatesStore(options.store);

		app.provide(statesStoreKey, statesStore);
		storesManager.addStore(statesStoreKey, statesStore);

		pluginsManager.addPlugin(devicesHomeAssistantPluginKey, {
			type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-home-assistant',
			name: 'Home Assistant',
			description: 'Connect and control your Home Assistant devices directly from the FastyBird Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: HomeAssistantConfigForm,
					},
					schemas: {
						pluginConfigSchema: HomeAssistantConfigSchema,
						pluginConfigEditFormSchema: HomeAssistantConfigEditFormSchema,
						pluginConfigUpdateReqSchema: HomeAssistantConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_HOME_ASSISTANT_TYPE,
					components: {
						deviceAddForm: HomeAssistantDeviceAddForm,
						deviceEditForm: HomeAssistantDeviceEditForm,
						channelPropertyAddForm: HomeAssistantChannelPropertyAddForm,
						channelPropertyEditForm: HomeAssistantChannelPropertyEditForm,
					},
					schemas: {
						deviceSchema: HomeAssistantDeviceSchema,
						deviceAddFormSchema: HomeAssistantDeviceAddFormSchema,
						deviceEditFormSchema: HomeAssistantDeviceEditFormSchema,
						deviceCreateReqSchema: HomeAssistantDeviceCreateReqSchema,
						deviceUpdateReqSchema: HomeAssistantDeviceUpdateReqSchema,
						channelSchema: HomeAssistantChannelSchema,
						channelCreateReqSchema: HomeAssistantChannelCreateReqSchema,
						channelUpdateReqSchema: HomeAssistantChannelUpdateReqSchema,
						channelPropertySchema: HomeAssistantChannelPropertySchema,
						channelPropertyAddFormSchema: HomeAssistantChannelPropertyAddFormSchema,
						channelPropertyEditFormSchema: HomeAssistantChannelPropertyEditFormSchema,
						channelPropertyCreateReqSchema: HomeAssistantChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: HomeAssistantChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
