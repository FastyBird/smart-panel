import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import type { IZigbee2mqttDiscoveredDevicesStoreActions, IZigbee2mqttDiscoveredDevicesStoreState } from './store/zigbee2mqtt-discovered-devices.store.types';
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

import { Zigbee2mqttConfigForm, Zigbee2mqttDeviceAddFormMultiStep, Zigbee2mqttDeviceEditForm } from './components/components';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from './devices-zigbee2mqtt.constants';
import enUS from './locales/en-US.json';
import { Zigbee2mqttConfigEditFormSchema } from './schemas/config.schemas';
import { Zigbee2mqttDeviceAddFormSchema, Zigbee2mqttDeviceEditFormSchema } from './schemas/devices.schemas';
import {
	Zigbee2mqttChannelPropertyCreateReqSchema,
	Zigbee2mqttChannelPropertySchema,
	Zigbee2mqttChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { Zigbee2mqttChannelCreateReqSchema, Zigbee2mqttChannelSchema, Zigbee2mqttChannelUpdateReqSchema } from './store/channels.store.schemas';
import { Zigbee2mqttConfigSchema, Zigbee2mqttConfigUpdateReqSchema } from './store/config.store.schemas';
import { Zigbee2mqttDeviceCreateReqSchema, Zigbee2mqttDeviceSchema, Zigbee2mqttDeviceUpdateReqSchema } from './store/devices.store.schemas';
import { discoveredDevicesStoreKey, registerZigbee2mqttDiscoveredDevicesStore } from './store/stores';

export const devicesZigbee2mqttPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IChannelPluginsComponents & IChannelPropertyPluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas,
		IZigbee2mqttDiscoveredDevicesStoreState,
		IZigbee2mqttDiscoveredDevicesStoreActions
	>
> = Symbol('FB-Plugin-DevicesZigbee2mqtt');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesZigbee2mqttPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const storesManager = injectStoresManager(app);

		const discoveredDevicesStore = registerZigbee2mqttDiscoveredDevicesStore(options.store);

		app.provide(discoveredDevicesStoreKey, discoveredDevicesStore);

		storesManager.addStore(discoveredDevicesStoreKey, discoveredDevicesStore);

		pluginsManager.addPlugin(devicesZigbee2mqttPluginKey, {
			type: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-zigbee2mqtt',
			name: 'Zigbee2MQTT',
			description: 'Connect and control your Zigbee devices via Zigbee2MQTT from the FastyBird Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: Zigbee2mqttConfigForm,
					},
					schemas: {
						pluginConfigSchema: Zigbee2mqttConfigSchema,
						pluginConfigEditFormSchema: Zigbee2mqttConfigEditFormSchema,
						pluginConfigUpdateReqSchema: Zigbee2mqttConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					components: {
						deviceAddForm: Zigbee2mqttDeviceAddFormMultiStep,
						deviceEditForm: Zigbee2mqttDeviceEditForm,
					},
					schemas: {
						deviceSchema: Zigbee2mqttDeviceSchema,
						deviceAddFormSchema: Zigbee2mqttDeviceAddFormSchema,
						deviceEditFormSchema: Zigbee2mqttDeviceEditFormSchema,
						deviceCreateReqSchema: Zigbee2mqttDeviceCreateReqSchema,
						deviceUpdateReqSchema: Zigbee2mqttDeviceUpdateReqSchema,
						channelSchema: Zigbee2mqttChannelSchema,
						channelCreateReqSchema: Zigbee2mqttChannelCreateReqSchema,
						channelUpdateReqSchema: Zigbee2mqttChannelUpdateReqSchema,
						channelPropertySchema: Zigbee2mqttChannelPropertySchema,
						channelPropertyCreateReqSchema: Zigbee2mqttChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: Zigbee2mqttChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
