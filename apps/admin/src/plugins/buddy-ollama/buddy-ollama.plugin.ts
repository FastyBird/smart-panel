import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_OLLAMA_PLUGIN_NAME } from './buddy-ollama.constants';
import { OllamaConfigForm } from './components/components';
import { locales } from './locales';
import { OllamaConfigEditFormSchema } from './schemas/schemas';
import { OllamaConfigSchema, OllamaConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyOllamaPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyOllama');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyOllamaPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyOllamaPluginKey, {
			type: BUDDY_OLLAMA_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-ollama',
			name: 'Ollama',
			description: 'LLM provider plugin for Buddy module using local Ollama inference',
			links: {
				documentation: 'https://ollama.com',
				devDocumentation: 'https://ollama.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OllamaConfigForm,
					},
					schemas: {
						pluginConfigSchema: OllamaConfigSchema,
						pluginConfigEditFormSchema: OllamaConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OllamaConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
