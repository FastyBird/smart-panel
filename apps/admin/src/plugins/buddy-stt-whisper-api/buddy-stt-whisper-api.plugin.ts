import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_STT_WHISPER_API_PLUGIN_NAME } from './buddy-stt-whisper-api.constants';
import { SttWhisperApiConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { SttWhisperApiConfigEditFormSchema } from './schemas/schemas';
import { SttWhisperApiConfigSchema, SttWhisperApiConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddySttWhisperApiPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddySttWhisperApi');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddySttWhisperApiPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddySttWhisperApiPluginKey, {
			type: BUDDY_STT_WHISPER_API_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-stt-whisper-api',
			name: 'Buddy Whisper API',
			description: 'STT provider plugin for Buddy module using OpenAI Whisper API',
			links: {
				documentation: 'https://platform.openai.com/docs',
				devDocumentation: 'https://platform.openai.com/docs',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: SttWhisperApiConfigForm,
					},
					schemas: {
						pluginConfigSchema: SttWhisperApiConfigSchema,
						pluginConfigEditFormSchema: SttWhisperApiConfigEditFormSchema,
						pluginConfigUpdateReqSchema: SttWhisperApiConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
