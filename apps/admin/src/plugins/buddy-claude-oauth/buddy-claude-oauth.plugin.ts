import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_CLAUDE_OAUTH_PLUGIN_NAME } from './buddy-claude-oauth.constants';
import { ClaudeOauthConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { ClaudeOauthConfigEditFormSchema } from './schemas/schemas';
import { ClaudeOauthConfigSchema, ClaudeOauthConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyClaudeOauthPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyClaudeOauth');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyClaudeOauthPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyClaudeOauthPluginKey, {
			type: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-claude-oauth',
			name: 'Buddy Claude OAuth',
			description: 'LLM provider plugin for Buddy module using Anthropic Claude with OAuth authentication',
			links: {
				documentation: 'https://docs.anthropic.com',
				devDocumentation: 'https://docs.anthropic.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ClaudeOauthConfigForm,
					},
					schemas: {
						pluginConfigSchema: ClaudeOauthConfigSchema,
						pluginConfigEditFormSchema: ClaudeOauthConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ClaudeOauthConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
