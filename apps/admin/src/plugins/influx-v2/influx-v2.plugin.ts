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
import { STORAGE_MODULE_NAME } from '../../modules/storage/storage.constants';

import { InfluxV2ConfigForm } from './components/components';
import { INFLUX_V2_PLUGIN_NAME } from './influx-v2.constants';
import { locales } from './locales';
import { InfluxV2ConfigEditFormSchema } from './schemas/config.schemas';
import { InfluxV2ConfigSchema, InfluxV2ConfigUpdateReqSchema } from './store/config.store.schemas';

const influxV2PluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-InfluxV2');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { influxV2Plugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(influxV2PluginKey, {
			type: INFLUX_V2_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.influx-v2',
			name: 'InfluxDB v2',
			description: 'InfluxDB 2.x time-series storage backend with Flux query language, token-based auth, and bucket management',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: InfluxV2ConfigForm,
					},
					schemas: {
						pluginConfigSchema: InfluxV2ConfigSchema,
						pluginConfigEditFormSchema: InfluxV2ConfigEditFormSchema,
						pluginConfigUpdateReqSchema: InfluxV2ConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME, STORAGE_MODULE_NAME],
			isCore: false,
		});
	},
};
