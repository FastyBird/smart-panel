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
import {
	EventType,
	type IRemoteAccessProviderPluginsComponents,
	REMOTE_ACCESS_MODULE_EVENT_PREFIX,
	REMOTE_ACCESS_MODULE_NAME,
	REMOTE_ACCESS_MODULE_PROVIDER_TYPE,
} from '../../modules/remote-access';

import { TailscaleConfigForm, TailscaleProviderCard, TailscaleSetupWizard } from './components/components';
import { locales } from './locales';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX,
	REMOTE_ACCESS_TAILSCALE_SETUP_EVENT_TYPE,
} from './remote-access-tailscale.constants';
import { TailscaleConfigEditFormSchema } from './schemas/schemas';
import { TailscaleConfigSchema, TailscaleConfigUpdateReqSchema } from './store/config.store.schemas';
import { tailscaleStatusStoreKey } from './store/keys';
import { registerTailscaleStatusStore } from './store/tailscale-status.store';

// Two separate `IPlugin` registrations, both describing the same Tailscale plugin, under two
// different identities `pluginsManager` is asked for by two unrelated lookups:
//
// - `remoteAccessTailscaleConfigPluginKey` (`type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME`,
//   `'remote-access-tailscale-plugin'`) is found by `usePlugin`/`usePlugins`
//   (`Config → Plugins`, `useConfigPluginEditForm`) matching `IPlugin.type === config.type`,
//   exactly like every other plugin in this codebase (influx-v1, weather-openweathermap, ...).
// - `remoteAccessTailscaleProviderPluginKey` (`type: REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX`,
//   `'remote-access-tailscale'`) is found by the remote-access module's own
//   `useRemoteAccessProviders.getElement()`, which matches `IPlugin.type === provider.type` -
//   the provider identity the backend and `RemoteAccessModule.Provider.Status` events use, not
//   the config identity. See the constants file for the full explanation.
const remoteAccessTailscaleConfigPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol(
	'FB-Plugin-RemoteAccessTailscale-Config'
);
const remoteAccessTailscaleProviderPluginKey: PluginInjectionKey<IPlugin<IRemoteAccessProviderPluginsComponents>> = Symbol(
	'FB-Plugin-RemoteAccessTailscale-Provider'
);

const links = {
	documentation: 'https://smart-panel.fastybird.com/docs',
	devDocumentation: 'https://smart-panel.fastybird.com/docs',
	bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
};

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { remoteAccessTailscalePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const tailscaleStatusStore = registerTailscaleStatusStore(options.store);

		storesManager.addStore(tailscaleStatusStoreKey, tailscaleStatusStore);

		pluginsManager.addPlugin(remoteAccessTailscaleConfigPluginKey, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.remote-access-tailscale',
			name: 'Tailscale',
			description: 'Reach this installation over a Tailscale mesh network without opening a port.',
			links,
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: TailscaleConfigForm,
					},
					schemas: {
						pluginConfigSchema: TailscaleConfigSchema,
						pluginConfigEditFormSchema: TailscaleConfigEditFormSchema,
						pluginConfigUpdateReqSchema: TailscaleConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: false,
		});

		pluginsManager.addPlugin(remoteAccessTailscaleProviderPluginKey, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX,
			source: 'com.fastybird.smart-panel.plugin.remote-access-tailscale',
			name: 'Tailscale',
			description: 'Reach this installation over a Tailscale mesh network without opening a port.',
			links,
			elements: [
				{
					type: REMOTE_ACCESS_MODULE_PROVIDER_TYPE,
					components: {
						providerCard: TailscaleProviderCard,
						// `IRemoteAccessProviderPluginsComponents.providerSetup` is typed as a
						// zero-props `DefineComponent` because nothing renders it through this element
						// yet (see the comment on that type) - `tailscale-provider-card.vue` mounts
						// `TailscaleSetupWizard` directly instead, fully typed with its real
						// `visible`/`initialStep` props. This registration exists so the wizard is
						// still discoverable through the documented contract once something does.
						providerSetup: TailscaleSetupWizard as unknown as IRemoteAccessProviderPluginsComponents['providerSetup'],
					},
					modules: [REMOTE_ACCESS_MODULE_NAME],
				},
			],
			modules: [REMOTE_ACCESS_MODULE_NAME],
			isCore: false,
		});

		// Events emitted while the browser was suspended are gone for good - re-read what we hold,
		// same as the remote-access module's own store.
		dataRefreshRegistry.register(remoteAccessTailscaleProviderPluginKey, (): Promise<void> => refreshLoadedStores([tailscaleStatusStore]));

		// The remote-access module only forwards `Provider.Status` and `Urls.Changed` to its own
		// store; `Setup.Progress` is explicitly left to "the owning provider plugin's own store"
		// (see `remote-access.module.ts`), which is this subscription.
		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(REMOTE_ACCESS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object' || data.payload === null) {
				return;
			}

			switch (data.event) {
				case EventType.PROVIDER_STATUS:
					// Every provider's status ticks over this same event - ignore every provider but
					// this plugin's own.
					if (data.payload.type !== REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX) {
						return;
					}

					tailscaleStatusStore.onEvent({ event: data.event, data: data.payload });

					return;

				case EventType.SETUP_PROGRESS:
					if (data.payload.type !== REMOTE_ACCESS_TAILSCALE_SETUP_EVENT_TYPE) {
						return;
					}

					tailscaleStatusStore.onEvent({ event: data.event, data: data.payload });

					return;

				case EventType.URLS_CHANGED:
					// Handled by the remote-access module's own store - nothing for this plugin to do.
					return;

				default:
					logger.warn('Unhandled remote access event in the Tailscale plugin:', data.event);
			}
		});
	},
};
