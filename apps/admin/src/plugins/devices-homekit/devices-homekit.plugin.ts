import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { HomeKitConfigForm } from './components/components';
import {
	DEVICES_HOMEKIT_PLUGIN_NAME,
	DEVICES_HOMEKIT_SOURCE,
} from './devices-homekit.constants';
import { locales } from './locales';
import { HomeKitConfigEditFormSchema } from './schemas/schemas';
import { HomeKitConfigSchema, HomeKitConfigUpdateReqSchema } from './store/config.store.schemas';
import { registerHomeKitBridgeStore } from './store/homekit-bridge.store';
import { homeKitBridgeStoreKey } from './store/keys';

export const devicesHomeKitPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-DevicesHomeKit');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesHomeKitPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const bridgeStore = registerHomeKitBridgeStore(options.store);
		app.provide(homeKitBridgeStoreKey, bridgeStore);
		storesManager.addStore(homeKitBridgeStoreKey, bridgeStore);

		pluginsManager.addPlugin(devicesHomeKitPluginKey, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			source: DEVICES_HOMEKIT_SOURCE,
			name: 'Apple HomeKit Gateway',
			description: 'Bridge Smart Panel devices to Apple Home via local HomeKit Accessory Protocol',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: HomeKitConfigForm,
					},
					schemas: {
						pluginConfigSchema: HomeKitConfigSchema,
						pluginConfigEditFormSchema: HomeKitConfigEditFormSchema,
						pluginConfigUpdateReqSchema: HomeKitConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: false,
		});
	},
};
