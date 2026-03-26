import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME } from './buddy-stt-whisper-local.constants';
import { SttWhisperLocalConfigForm } from './components/components';
import { locales } from './locales';
import { SttWhisperLocalConfigEditFormSchema } from './schemas/schemas';
import { SttWhisperLocalConfigSchema, SttWhisperLocalConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddySttWhisperLocalPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddySttWhisperLocal');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddySttWhisperLocalPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddySttWhisperLocalPluginKey, {
			type: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-stt-whisper-local',
			name: 'Whisper Local',
			description: 'STT provider plugin for Buddy module using locally installed Whisper',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: SttWhisperLocalConfigForm,
					},
					schemas: {
						pluginConfigSchema: SttWhisperLocalConfigSchema,
						pluginConfigEditFormSchema: SttWhisperLocalConfigEditFormSchema,
						pluginConfigUpdateReqSchema: SttWhisperLocalConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
