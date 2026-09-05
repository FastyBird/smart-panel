import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import {
	type IPlugin,
	type PluginInjectionKey,
	injectDataRefreshRegistry,
	injectLogger,
	injectPluginsManager,
	injectSockets,
	injectStoresManager,
	refreshLoadedStores,
} from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { HomeKitConfigForm } from './components/components';
import { DEVICES_HOMEKIT_PLUGIN_EVENT_PREFIX, DEVICES_HOMEKIT_PLUGIN_NAME, DEVICES_HOMEKIT_SOURCE, EventType } from './devices-homekit.constants';
import { locales } from './locales';
import { HomeKitConfigEditFormSchema } from './schemas/schemas';
import { HomeKitConfigSchema, HomeKitConfigUpdateReqSchema } from './store/config.store.schemas';
import { registerHomeKitBridgeStore } from './store/homekit-bridge.store';
import { homeKitBridgeStoreKey } from './store/keys';

export const devicesHomeKitPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-DevicesHomeKit');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

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
			name: 'Apple HomeKit Bridge',
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

		dataRefreshRegistry.register(devicesHomeKitPluginKey, (): Promise<void> => refreshLoadedStores([bridgeStore]));

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(DEVICES_HOMEKIT_PLUGIN_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object' || data.payload === null) {
				return;
			}

			switch (data.event) {
				case EventType.BRIDGE_STATUS_CHANGED:
					bridgeStore.onEvent({ event: data.event, data: data.payload });
					return;

				default:
					logger.warn('Unhandled devices-homekit event:', data.event);
			}
		});
	},
};
