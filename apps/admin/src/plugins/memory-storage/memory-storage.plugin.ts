import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	CONFIG_MODULE_NAME,
	CONFIG_MODULE_PLUGIN_TYPE,
	type IPluginsComponents,
	type IPluginsSchemas,
} from '../../modules/config';

import { locales } from './locales';
import { MEMORY_STORAGE_PLUGIN_NAME } from './memory-storage.constants';
import { MemoryStorageConfigSchema, MemoryStorageConfigUpdateReqSchema } from './store/config.store.schemas';

const memoryStoragePluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> =
	Symbol('FB-Plugin-MemoryStorage');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { memoryStoragePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(memoryStoragePluginKey, {
			type: MEMORY_STORAGE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.memory-storage',
			name: 'In-Memory Storage',
			description: 'In-memory ring-buffer storage. Data is lost on restart. Used as default fallback.',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					schemas: {
						pluginConfigSchema: MemoryStorageConfigSchema,
						pluginConfigUpdateReqSchema: MemoryStorageConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: false,
		});
	},
};
