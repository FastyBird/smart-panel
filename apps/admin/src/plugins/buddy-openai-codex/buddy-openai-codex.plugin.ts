import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from './buddy-openai-codex.constants';
import { OpenAiCodexConfigForm } from './components/components';
import { locales } from './locales';
import { OpenAiCodexConfigEditFormSchema } from './schemas/schemas';
import { OpenAiCodexConfigSchema, OpenAiCodexConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyOpenaiCodexPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyOpenaiCodex');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyOpenaiCodexPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyOpenaiCodexPluginKey, {
			type: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-openai-codex',
			name: 'OpenAI Codex',
			description: 'LLM provider plugin for Buddy module using OpenAI Codex with OAuth authentication',
			links: {
				documentation: 'https://platform.openai.com/docs',
				devDocumentation: 'https://platform.openai.com/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OpenAiCodexConfigForm,
					},
					schemas: {
						pluginConfigSchema: OpenAiCodexConfigSchema,
						pluginConfigEditFormSchema: OpenAiCodexConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OpenAiCodexConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
