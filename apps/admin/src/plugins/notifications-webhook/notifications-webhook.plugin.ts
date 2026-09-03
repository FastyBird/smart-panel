import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { WebhookConfigForm } from './components/components';
import { locales } from './locales';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from './notifications-webhook.constants';
import { WebhookConfigEditFormSchema } from './schemas/schemas';
import { WebhookConfigSchema, WebhookConfigUpdateReqSchema } from './store/config.store.schemas';

export const notificationsWebhookPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-NotificationsWebhook');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { notificationsWebhookPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(notificationsWebhookPluginKey, {
			type: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.notifications-webhook',
			name: 'Generic webhook',
			description: 'Forwards system notifications as a JSON POST request to any URL you configure',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: WebhookConfigForm,
					},
					schemas: {
						pluginConfigSchema: WebhookConfigSchema,
						pluginConfigEditFormSchema: WebhookConfigEditFormSchema,
						pluginConfigUpdateReqSchema: WebhookConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
