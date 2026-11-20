import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import {
	type IPlugin,
	type PluginInjectionKey,
	injectDataRefreshRegistry,
	injectPluginsManager,
	injectStoresManager,
	refreshLoadedStores,
} from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import {
	DEVICES_MODULE_NAME,
	type IChannelPluginsSchemas,
	type IChannelPropertyPluginsSchemas,
	type IDevicePluginsComponents,
	type IDevicePluginsSchemas,
} from '../../modules/devices';

import { ProtectConfigForm } from './components/components';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE } from './devices-unifi-protect.constants';
import { locales } from './locales';
import { ProtectConfigEditFormSchema } from './schemas/config.schemas';
import {
	ProtectChannelPropertyCreateReqSchema,
	ProtectChannelPropertySchema,
	ProtectChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ProtectChannelCreateReqSchema, ProtectChannelSchema, ProtectChannelUpdateReqSchema } from './store/channels.store.schemas';
import { ProtectConfigSchema, ProtectConfigUpdateReqSchema } from './store/config.store.schemas';
import { ProtectDeviceCreateReqSchema, ProtectDeviceSchema, ProtectDeviceUpdateReqSchema } from './store/devices.store.schemas';
import { protectDiscoveryStoreKey, protectStatusStoreKey } from './store/keys';
import { registerProtectDiscoveryStore } from './store/protect-discovery.store';
import { registerProtectStatusStore } from './store/protect-status.store';

export const devicesUnifiProtectPluginKey: PluginInjectionKey<
	IPlugin<
		IDevicePluginsComponents & IPluginsComponents,
		IDevicePluginsSchemas & IChannelPluginsSchemas & IChannelPropertyPluginsSchemas & IPluginsSchemas
	>
> = Symbol('FB-Plugin-DevicesUnifiProtect');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			options.i18n.global.setLocaleMessage(locale, defaultsDeep(currentMessages, { devicesUnifiProtectPlugin: translations }));
		}

		const statusStore = registerProtectStatusStore(options.store);
		const discoveryStore = registerProtectDiscoveryStore(options.store);
		app.provide(protectStatusStoreKey, statusStore);
		app.provide(protectDiscoveryStoreKey, discoveryStore);
		storesManager.addStore(protectStatusStoreKey, statusStore);
		storesManager.addStore(protectDiscoveryStoreKey, discoveryStore);

		pluginsManager.addPlugin(devicesUnifiProtectPluginKey, {
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.devices-unifi-protect',
			name: 'UniFi Protect',
			description: 'Connect a UniFi Protect console and adopt its cameras, sensors and lights into the FastyBird Smart Panel',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: { pluginConfigEditForm: ProtectConfigForm },
					schemas: {
						pluginConfigSchema: ProtectConfigSchema,
						pluginConfigEditFormSchema: ProtectConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ProtectConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					// No deviceWizard yet: adoption arrives with the wizard adapter (part 2 of #1188).
					type: DEVICES_UNIFI_PROTECT_TYPE,
					schemas: {
						deviceSchema: ProtectDeviceSchema,
						deviceCreateReqSchema: ProtectDeviceCreateReqSchema,
						deviceUpdateReqSchema: ProtectDeviceUpdateReqSchema,
						channelSchema: ProtectChannelSchema,
						channelCreateReqSchema: ProtectChannelCreateReqSchema,
						channelUpdateReqSchema: ProtectChannelUpdateReqSchema,
						channelPropertySchema: ProtectChannelPropertySchema,
						channelPropertyCreateReqSchema: ProtectChannelPropertyCreateReqSchema,
						channelPropertyUpdateReqSchema: ProtectChannelPropertyUpdateReqSchema,
					},
					modules: [DEVICES_MODULE_NAME],
				},
			],
			modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME],
			isCore: true,
		});

		// The status is polled only while a panel is mounted, so after a gap re-read it only if it was ever loaded.
		dataRefreshRegistry.register(devicesUnifiProtectPluginKey, (): Promise<void> => refreshLoadedStores([statusStore]));
	},
};
