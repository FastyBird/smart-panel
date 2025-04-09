import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import { DeviceDetailPageAddForm, DeviceDetailPageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { DeviceDetailPageCreateReqSchema, DeviceDetailPageSchema, DeviceDetailPageUpdateReqSchema } from './store/pages.store.schemas';

export const tilesPagePluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> =
	Symbol('FB-Plugin-DashboardDeviceDetailPage');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { thirdPartyDevicesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(tilesPagePluginKey, {
			type: 'device-detail',
			source: 'com.fastybird.smart-panel.tiles-page',
			name: 'Device Detail Page',
			description: 'Device detail page plugin for FastyBird IoT Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			components: {
				pageAddForm: DeviceDetailPageAddForm,
				pageEditForm: DeviceDetailPageEditForm,
			},
			schemas: {
				pageSchema: DeviceDetailPageSchema,
				pageCreateReqSchema: DeviceDetailPageCreateReqSchema,
				pageUpdateReqSchema: DeviceDetailPageUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
