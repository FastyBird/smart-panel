import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import { DeviceDetailPageAddForm, DeviceDetailPageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME, PAGES_DEVICE_DETAIL_TYPE } from './pages-device-detail.constants';
import { DeviceDetailPageAddFormSchema, DeviceDetailPageEditFormSchema } from './schemas/pages.schemas';
import { DeviceDetailPageCreateReqSchema, DeviceDetailPageSchema, DeviceDetailPageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesDeviceDetailPluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> =
	Symbol('FB-Plugin-PagesDeviceDetail');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { pagesDeviceDetailPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(pagesDeviceDetailPluginKey, {
			type: PAGES_DEVICE_DETAIL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.pages-device-detail',
			name: 'Device Detail Page',
			description: 'A dedicated page focused on a single device. Perfect for viewing and controlling all properties of a specific device in detail.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: PAGES_DEVICE_DETAIL_TYPE,
					components: {
						pageAddForm: DeviceDetailPageAddForm,
						pageEditForm: DeviceDetailPageEditForm,
					},
					schemas: {
						pageSchema: DeviceDetailPageSchema,
						pageAddFormSchema: DeviceDetailPageAddFormSchema,
						pageEditFormSchema: DeviceDetailPageEditFormSchema,
						pageCreateReqSchema: DeviceDetailPageCreateReqSchema,
						pageUpdateReqSchema: DeviceDetailPageUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
