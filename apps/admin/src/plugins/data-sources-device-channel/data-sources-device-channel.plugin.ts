import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IDataSourcePluginsComponents, type IDataSourcePluginsSchemas } from '../../modules/dashboard';

import { DeviceChannelDataSourceAddForm, DeviceChannelDataSourceEditForm } from './components/components';
import { DATA_SOURCES_DEVICE_PLUGIN_NAME, DATA_SOURCES_DEVICE_TYPE } from './data-sources-device-channel.constants';
import enUS from './locales/en-US.json';
import { DeviceChannelDataSourceAddFormSchema, DeviceChannelDataSourceEditFormSchema } from './schemas/data-sources.schemas';
import {
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceSchema,
	DeviceChannelDataSourceUpdateReqSchema,
} from './store/data-sources.store.schemas';

export const dataSourcesDeviceChannelPluginKey: PluginInjectionKey<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>> =
	Symbol('FB-Plugin-DataSourcesDeviceChannel');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { dataSourcesDeviceChannelPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(dataSourcesDeviceChannelPluginKey, {
			type: DATA_SOURCES_DEVICE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.data-source-device-channel',
			name: 'Device channel property data source',
			description:
				'Enables dashboard tiles, pages, etc. to pull real-time data directly from specific channels within your IoT devices. Ideal for visualizing sensor values, statuses, or actuator states in a granular and dynamic way.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: DATA_SOURCES_DEVICE_TYPE,
					name: 'Device channel property',
					components: {
						dataSourceAddForm: DeviceChannelDataSourceAddForm,
						dataSourceEditForm: DeviceChannelDataSourceEditForm,
					},
					schemas: {
						dataSourceSchema: DeviceChannelDataSourceSchema,
						dataSourceAddFormSchema: DeviceChannelDataSourceAddFormSchema,
						dataSourceEditFormSchema: DeviceChannelDataSourceEditFormSchema,
						dataSourceCreateReqSchema: DeviceChannelDataSourceCreateReqSchema,
						dataSourceUpdateReqSchema: DeviceChannelDataSourceUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
