import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { HomeyConfigForm } from './components/components';
import { useDevicesWizard } from './composables/composables';
import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE } from './devices-homey.constants';
import { locales } from './locales';
import { HomeyConfigEditFormSchema } from './schemas/config.schemas';
import {
	HomeyChannelPropertyCreateReqSchema,
	HomeyChannelPropertySchema,
	HomeyChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { HomeyChannelCreateReqSchema, HomeyChannelSchema, HomeyChannelUpdateReqSchema } from './store/channels.store.schemas';
import { HomeyConfigSchema, HomeyConfigUpdateReqSchema } from './store/config.store.schemas';
import { HomeyDeviceCreateReqSchema, HomeyDeviceSchema, HomeyDeviceUpdateReqSchema } from './store/devices.store.schemas';
import { registerHomeyCloudAuthorizationStore } from './store/homey-cloud-authorization.store';
import { registerHomeyInventoryStore } from './store/homey-inventory.store';
import { registerHomeyStatusStore } from './store/homey-status.store';
import { homeyCloudAuthorizationStoreKey, homeyInventoryStoreKey, homeyStatusStoreKey } from './store/keys';

export const devicesHomeyPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesHomey');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			options.i18n.global.setLocaleMessage(locale, defaultsDeep(currentMessages, { devicesHomeyPlugin: translations }));
		}

		const cloudAuthorizationStore = registerHomeyCloudAuthorizationStore(options.store);
		const inventoryStore = registerHomeyInventoryStore(options.store);
		const statusStore = registerHomeyStatusStore(options.store);
		app.provide(homeyCloudAuthorizationStoreKey, cloudAuthorizationStore);
		app.provide(homeyInventoryStoreKey, inventoryStore);
		app.provide(homeyStatusStoreKey, statusStore);
		storesManager.addStore(homeyCloudAuthorizationStoreKey, cloudAuthorizationStore);
		storesManager.addStore(homeyInventoryStoreKey, inventoryStore);
		storesManager.addStore(homeyStatusStoreKey, statusStore);

		pluginsManager.addPlugin(devicesHomeyPluginKey, {
			type: DEVICES_HOMEY_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-homey',
			name: 'Homey',
			description: 'Connect, adopt, monitor, and control Homey devices from the FastyBird Smart Panel',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: { pluginConfigEditForm: HomeyConfigForm },
					schemas: {
						pluginConfigSchema: HomeyConfigSchema,
						pluginConfigEditFormSchema: HomeyConfigEditFormSchema,
						pluginConfigUpdateReqSchema: HomeyConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: DEVICES_HOMEY_TYPE,
					components: { deviceWizardAdapter: useDevicesWizard },
					schemas: {
						deviceSchema: HomeyDeviceSchema,
						deviceCreateReqSchema: HomeyDeviceCreateReqSchema,
						deviceUpdateReqSchema: HomeyDeviceUpdateReqSchema,
						channelSchema: HomeyChannelSchema,
						channelCreateReqSchema: HomeyChannelCreateReqSchema,
						channelUpdateReqSchema: HomeyChannelUpdateReqSchema,
						channelPropertySchema: HomeyChannelPropertySchema,
						channelPropertyCreateReqSchema: HomeyChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: HomeyChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
