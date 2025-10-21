import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';

import { RotatingFileConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from './logger-rotating-file.constants';
import { RotatingFileConfigEditFormSchema } from './schemas/config.schemas';
import { RotatingFileConfigSchema, RotatingFileConfigUpdateReqSchema } from './store/config.store.schemas';

export const loggerRotatingFilePluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-LoggerRotatingFile');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { loggerRotatingFilePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(loggerRotatingFilePluginKey, {
			type: LOGGER_ROTATING_FILE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.logger-rotating-file',
			name: 'Rotating File Logger',
			description:
				'Adds optional file-based log persistence with daily rotation and automatic cleanup. Useful for long-term log retention or offline analysis.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: RotatingFileConfigForm,
					},
					schemas: {
						pluginConfigSchema: RotatingFileConfigSchema,
						pluginConfigEditFormSchema: RotatingFileConfigEditFormSchema,
						pluginConfigUpdateReqSchema: RotatingFileConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});
	},
};
