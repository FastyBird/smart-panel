import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { NotificationsDiscordConfigForm } from './components/components';
import { locales } from './locales';
import { NOTIFICATIONS_DISCORD_PLUGIN_NAME } from './notifications-discord.constants';
import { NotificationsDiscordConfigEditFormSchema } from './schemas/schemas';
import { NotificationsDiscordConfigSchema, NotificationsDiscordConfigUpdateReqSchema } from './store/config.store.schemas';

export const notificationsDiscordPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-NotificationsDiscord');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { notificationsDiscordPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(notificationsDiscordPluginKey, {
			type: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.notifications-discord',
			name: 'Discord',
			description: 'Forwards system notifications to a Discord channel through an incoming webhook',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://discord.com/developers/docs/resources/webhook',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: NotificationsDiscordConfigForm,
					},
					schemas: {
						pluginConfigSchema: NotificationsDiscordConfigSchema,
						pluginConfigEditFormSchema: NotificationsDiscordConfigEditFormSchema,
						pluginConfigUpdateReqSchema: NotificationsDiscordConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
