import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IDataSourcePluginsComponents, type IDataSourcePluginsSchemas } from '../../modules/dashboard';

import enUS from './locales/en-US.json';
import {
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceSchema,
	DeviceChannelDataSourceUpdateReqSchema,
} from './store/dataSources.store.schemas';

export const dataSourcesDeviceChannelPluginKey: PluginInjectionKey<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>> =
	Symbol('FB-Plugin-DataSourcesDeviceChannel');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { thirdPartyDevicesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(dataSourcesDeviceChannelPluginKey, {
			type: 'device-channel',
			source: 'com.fastybird.smart-panel.plugin.data-source-device-channel',
			name: 'Device Channel Data Sources',
			description: '',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			schemas: {
				dataSourceSchema: DeviceChannelDataSourceSchema,
				dataSourceCreateReqSchema: DeviceChannelDataSourceCreateReqSchema,
				dataSourceUpdateReqSchema: DeviceChannelDataSourceUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
