import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_CLAUDE_PLUGIN_NAME } from './buddy-claude.constants';
import { ClaudeConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { ClaudeConfigEditFormSchema } from './schemas/schemas';
import { ClaudeConfigSchema, ClaudeConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyClaudePluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyClaude');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyClaudePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyClaudePluginKey, {
			type: BUDDY_CLAUDE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-claude',
			name: 'Claude',
			description: 'LLM provider plugin for Buddy module using Anthropic Claude API',
			links: {
				documentation: 'https://docs.anthropic.com',
				devDocumentation: 'https://docs.anthropic.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ClaudeConfigForm,
					},
					schemas: {
						pluginConfigSchema: ClaudeConfigSchema,
						pluginConfigEditFormSchema: ClaudeConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ClaudeConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
