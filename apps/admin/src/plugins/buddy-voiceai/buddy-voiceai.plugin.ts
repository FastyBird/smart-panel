import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_VOICEAI_PLUGIN_NAME } from './buddy-voiceai.constants';
import { VoiceaiConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { VoiceaiConfigEditFormSchema } from './schemas/schemas';
import { VoiceaiConfigSchema, VoiceaiConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyVoiceaiPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyVoiceai');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyVoiceaiPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyVoiceaiPluginKey, {
			type: BUDDY_VOICEAI_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-voiceai',
			name: 'Voice.ai',
			description: 'TTS provider plugin for Buddy module using Voice.ai API',
			links: {
				documentation: 'https://voice.ai/docs',
				devDocumentation: 'https://voice.ai/docs',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: VoiceaiConfigForm,
					},
					schemas: {
						pluginConfigSchema: VoiceaiConfigSchema,
						pluginConfigEditFormSchema: VoiceaiConfigEditFormSchema,
						pluginConfigUpdateReqSchema: VoiceaiConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
