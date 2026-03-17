import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME } from './buddy-claude-setup-token.constants';
import { ClaudeSetupTokenConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { ClaudeSetupTokenConfigEditFormSchema } from './schemas/schemas';
import { ClaudeSetupTokenConfigSchema, ClaudeSetupTokenConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyClaudeSetupTokenPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyClaudeSetupToken');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyClaudeSetupTokenPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyClaudeSetupTokenPluginKey, {
			type: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-claude-setup-token',
			name: 'Claude Setup Token',
			description: 'LLM provider plugin for Buddy module using Anthropic Claude with setup-token authentication',
			links: {
				documentation: 'https://docs.anthropic.com',
				devDocumentation: 'https://docs.anthropic.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ClaudeSetupTokenConfigForm,
					},
					schemas: {
						pluginConfigSchema: ClaudeSetupTokenConfigSchema,
						pluginConfigEditFormSchema: ClaudeSetupTokenConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ClaudeSetupTokenConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
