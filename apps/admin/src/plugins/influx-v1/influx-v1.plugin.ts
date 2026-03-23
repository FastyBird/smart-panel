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

import { InfluxV1ConfigForm } from './components/components';
import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';
import enUS from './locales/en-US.json';
import { InfluxV1ConfigEditFormSchema } from './schemas/config.schemas';
import { InfluxV1ConfigSchema, InfluxV1ConfigUpdateReqSchema } from './store/config.store.schemas';

const influxV1PluginKey: PluginInjectionKey<IPlugin<IPluginsComponents, IPluginsSchemas>> = Symbol('FB-Plugin-InfluxV1');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { influxV1Plugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(influxV1PluginKey, {
			type: INFLUX_V1_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.influx-v1',
			name: 'InfluxDB v1',
			description: 'InfluxDB 1.x time-series storage backend with retention policies and continuous queries',
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				devDocumentation: 'https://smart-panel.fastybird.com/docs',
				bugsTracking: 'https://github.com/FastyBird/smart-panel/issues',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: InfluxV1ConfigForm,
					},
					schemas: {
						pluginConfigSchema: InfluxV1ConfigSchema,
						pluginConfigEditFormSchema: InfluxV1ConfigEditFormSchema,
						pluginConfigUpdateReqSchema: InfluxV1ConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: false,
		});
	},
};
