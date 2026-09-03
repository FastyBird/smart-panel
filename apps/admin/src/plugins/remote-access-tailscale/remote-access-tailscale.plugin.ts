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
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from './remote-access-tailscale.constants';
import { TailscaleConfigEditFormSchema } from './schemas/schemas';
import { TailscaleConfigSchema, TailscaleConfigUpdateReqSchema } from './store/config.store.schemas';
import { tailscaleStatusStoreKey } from './store/keys';
import { registerTailscaleStatusStore } from './store/tailscale-status.store';

// One `IPlugin`, keyed by `REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME` - the single identity the backend
// reports everywhere since fix #936 (config, extensions, the provider registry, and every
// `RemoteAccessModule.*` event payload all agree on `'remote-access-tailscale-plugin'`; see the
// constants file). Two elements: `CONFIG_MODULE_PLUGIN_TYPE`, found by
// `Config → Plugins`/`useConfigPluginEditForm`, and `REMOTE_ACCESS_MODULE_PROVIDER_TYPE`, found
// by the remote-access module's `useRemoteAccessProviders.getElement()`.
const remoteAccessTailscalePluginKey: PluginInjectionKey<IPlugin<IPluginsComponents & IRemoteAccessProviderPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-RemoteAccessTailscale');

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

		pluginsManager.addPlugin(remoteAccessTailscalePluginKey, {
			type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.remote-access-tailscale',
			name: 'Tailscale',
			description: 'Reach this installation over a Tailscale mesh network without opening a port.',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
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
			modules: [CONFIG_MODULE_NAME, REMOTE_ACCESS_MODULE_NAME],
			isCore: false,
		});

		// Events emitted while the browser was suspended are gone for good - re-read what we hold,
		// same as the remote-access module's own store.
		dataRefreshRegistry.register(remoteAccessTailscalePluginKey, (): Promise<void> => refreshLoadedStores([tailscaleStatusStore]));

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
				case EventType.SETUP_PROGRESS:
					// Every provider's status tick, and every provider plugin's own setup progress,
					// share these two events - both payloads carry `type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME`
					// (see the constants file), so the same guard filters both to this plugin's own.
					if (data.payload.type !== REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME) {
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
