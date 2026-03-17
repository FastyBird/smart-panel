import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_SYSTEM_TTS_PLUGIN_NAME } from './buddy-system-tts.constants';
import { SystemTtsConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { SystemTtsConfigEditFormSchema } from './schemas/schemas';
import { SystemTtsConfigSchema, SystemTtsConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddySystemTtsPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddySystemTts');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddySystemTtsPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddySystemTtsPluginKey, {
			type: BUDDY_SYSTEM_TTS_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-system-tts',
			name: 'System TTS',
			description: 'Local TTS provider plugin for Buddy module using piper or espeak',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: SystemTtsConfigForm,
					},
					schemas: {
						pluginConfigSchema: SystemTtsConfigSchema,
						pluginConfigEditFormSchema: SystemTtsConfigEditFormSchema,
						pluginConfigUpdateReqSchema: SystemTtsConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
