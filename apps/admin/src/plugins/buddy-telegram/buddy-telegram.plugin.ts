import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_TELEGRAM_PLUGIN_NAME } from './buddy-telegram.constants';
import { TelegramConfigForm } from './components/components';
import { locales } from './locales';
import { TelegramConfigEditFormSchema } from './schemas/schemas';
import { TelegramConfigSchema, TelegramConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyTelegramPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyTelegram');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyTelegramPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyTelegramPluginKey, {
			type: BUDDY_TELEGRAM_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-telegram',
			name: 'Telegram',
			description: 'Telegram bot adapter plugin for Buddy module',
			links: {
				documentation: 'https://core.telegram.org/bots',
				devDocumentation: 'https://core.telegram.org/bots/api',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: TelegramConfigForm,
					},
					schemas: {
						pluginConfigSchema: TelegramConfigSchema,
						pluginConfigEditFormSchema: TelegramConfigEditFormSchema,
						pluginConfigUpdateReqSchema: TelegramConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
