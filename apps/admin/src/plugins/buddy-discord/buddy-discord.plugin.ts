import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_DISCORD_PLUGIN_NAME } from './buddy-discord.constants';
import { DiscordConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { DiscordConfigEditFormSchema } from './schemas/schemas';
import { DiscordConfigSchema, DiscordConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyDiscordPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyDiscord');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyDiscordPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyDiscordPluginKey, {
			type: BUDDY_DISCORD_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-discord',
			name: 'Discord',
			description: 'Discord bot adapter plugin for Buddy module with multi-channel space mapping',
			links: {
				documentation: 'https://discord.com/developers/docs',
				devDocumentation: 'https://discord.com/developers/docs/intro',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: DiscordConfigForm,
					},
					schemas: {
						pluginConfigSchema: DiscordConfigSchema,
						pluginConfigEditFormSchema: DiscordConfigEditFormSchema,
						pluginConfigUpdateReqSchema: DiscordConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
