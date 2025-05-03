import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsComponents,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsComponents,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { HomeAssistantDeviceAddForm, HomeAssistantDeviceEditForm } from './components/components';
import { DEVICES_HOME_ASSISTANT_PLUGIN_TYPE } from './devices-home-assistant.constants';
import enUS from './locales/en-US.json';
import { HomeAssistantChannelPropertyAddFormSchema, HomeAssistantChannelPropertyEditFormSchema } from './schemas/channels.properties.schemas';
import { HomeAssistantChannelAddFormSchema, HomeAssistantChannelEditFormSchema } from './schemas/channels.schemas';
import { HomeAssistantDeviceAddFormSchema, HomeAssistantDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	HomeAssistantChannelPropertyCreateReqSchema,
	HomeAssistantChannelPropertySchema,
	HomeAssistantChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { HomeAssistantChannelCreateReqSchema, HomeAssistantChannelSchema, HomeAssistantChannelUpdateReqSchema } from './store/channels.store.schemas';
import { HomeAssistantDeviceCreateReqSchema, HomeAssistantDeviceSchema, HomeAssistantDeviceUpdateReqSchema } from './store/devices.store.schemas';
import {
	discoveredDevicesStoreKey,
	registerHomeAssistantDiscoveredDevicesStore,
	registerHomeAssistantStatesStore,
	statesStoreKey,
} from './store/stores';

export const devicesHomeAssistantPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas
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
			type: DEVICES_HOME_ASSISTANT_PLUGIN_TYPE,
			source: 'com.fastybird.smart-panel.plugin.devices-home-assistant',
			name: 'Home Assistant Devices',
			description: 'Home Assistant devices plugin for FastyBird IoT Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			components: {
				deviceAddForm: HomeAssistantDeviceAddForm,
				deviceEditForm: HomeAssistantDeviceEditForm,
			},
			schemas: {
				deviceSchema: HomeAssistantDeviceSchema,
				deviceAddFormSchema: HomeAssistantDeviceAddFormSchema,
				deviceEditFormSchema: HomeAssistantDeviceEditFormSchema,
				deviceCreateReqSchema: HomeAssistantDeviceCreateReqSchema,
				deviceUpdateReqSchema: HomeAssistantDeviceUpdateReqSchema,
				channelSchema: HomeAssistantChannelSchema,
				channelAddFormSchema: HomeAssistantChannelAddFormSchema,
				channelEditFormSchema: HomeAssistantChannelEditFormSchema,
				channelCreateReqSchema: HomeAssistantChannelCreateReqSchema,
				channelUpdateReqSchema: HomeAssistantChannelUpdateReqSchema,
				channelPropertySchema: HomeAssistantChannelPropertySchema,
				channelPropertyAddFormSchema: HomeAssistantChannelPropertyAddFormSchema,
				channelPropertyEditFormSchema: HomeAssistantChannelPropertyEditFormSchema,
				channelPropertyCreateReqSchema: HomeAssistantChannelPropertyCreateReqSchema,
				channelPropertyUpdateReqSchema: HomeAssistantChannelPropertyUpdateReqSchema,
			},
			modules: [DEVICES_MODULE_NAME],
			isCore: true,
		});
	},
};
