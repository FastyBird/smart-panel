import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_OPENAI_PLUGIN_NAME } from './buddy-openai.constants';
import { OpenAiConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { OpenAiConfigEditFormSchema } from './schemas/schemas';
import { OpenAiConfigSchema, OpenAiConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyOpenaiPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyOpenai');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyOpenaiPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyOpenaiPluginKey, {
			type: BUDDY_OPENAI_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-openai',
			name: 'OpenAI',
			description: 'LLM provider plugin for Buddy module using OpenAI API (GPT models)',
			links: {
				documentation: 'https://platform.openai.com/docs',
				devDocumentation: 'https://platform.openai.com/docs',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OpenAiConfigForm,
					},
					schemas: {
						pluginConfigSchema: OpenAiConfigSchema,
						pluginConfigEditFormSchema: OpenAiConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OpenAiConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
