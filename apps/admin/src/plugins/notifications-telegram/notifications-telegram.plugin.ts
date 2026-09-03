import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { NotificationsTelegramConfigForm } from './components/components';
import { locales } from './locales';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_NAME } from './notifications-telegram.constants';
import { NotificationsTelegramConfigEditFormSchema } from './schemas/schemas';
import { NotificationsTelegramConfigSchema, NotificationsTelegramConfigUpdateReqSchema } from './store/config.store.schemas';

export const notificationsTelegramPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-NotificationsTelegram');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { notificationsTelegramPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(notificationsTelegramPluginKey, {
			type: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.notifications-telegram',
			name: 'Telegram',
			description: 'Forwards system notifications to a Telegram chat through a bot',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://core.telegram.org/bots/api#sendmessage',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: NotificationsTelegramConfigForm,
					},
					schemas: {
						pluginConfigSchema: NotificationsTelegramConfigSchema,
						pluginConfigEditFormSchema: NotificationsTelegramConfigEditFormSchema,
						pluginConfigUpdateReqSchema: NotificationsTelegramConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
