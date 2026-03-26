import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { BUDDY_ELEVENLABS_PLUGIN_NAME } from './buddy-elevenlabs.constants';
import { ElevenlabsConfigForm } from './components/components';
import { locales } from './locales';
import { ElevenlabsConfigEditFormSchema } from './schemas/schemas';
import { ElevenlabsConfigSchema, ElevenlabsConfigUpdateReqSchema } from './store/config.store.schemas';

export const buddyElevenlabsPluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-BuddyElevenlabs');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyElevenlabsPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(buddyElevenlabsPluginKey, {
			type: BUDDY_ELEVENLABS_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.buddy-elevenlabs',
			name: 'ElevenLabs',
			description: 'TTS provider plugin for Buddy module using ElevenLabs API',
			links: {
				documentation: 'https://elevenlabs.io/docs',
				devDocumentation: 'https://elevenlabs.io/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: ElevenlabsConfigForm,
					},
					schemas: {
						pluginConfigSchema: ElevenlabsConfigSchema,
						pluginConfigEditFormSchema: ElevenlabsConfigEditFormSchema,
						pluginConfigUpdateReqSchema: ElevenlabsConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
