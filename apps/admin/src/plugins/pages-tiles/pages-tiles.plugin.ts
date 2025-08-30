import type { App } from 'vue';
import type { RouteLocationResolvedGeneric, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	DASHBOARD_MODULE_NAME,
	RouteNames as DashboardRouteNames,
	type IPage,
	type IPagePluginRoutes,
	type IPagePluginsComponents,
	type IPagePluginsSchemas,
} from '../../modules/dashboard';

import { TilesPageAddForm, TilesPageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { PAGES_TILES_PLUGIN_NAME, PAGES_TILES_TYPE, RouteNames } from './pages-tiles.constants';
import { PluginRoutes } from './router';
import { TilesPageAddFormSchema, TilesPageEditFormSchema } from './schemas/pages.schemas';
import { TilesPageCreateReqSchema, TilesPageSchema, TilesPageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesTilesPluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes>> =
	Symbol('FB-Plugin-PagesTiles');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { pagesTilesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			PluginRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(DashboardRouteNames.PAGE_PLUGIN, route);
			});
		}

		pluginsManager.addPlugin(pagesTilesPluginKey, {
			type: PAGES_TILES_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.pages-tiles',
			name: 'Tiles Page',
			description: 'A flexible page layout displaying multiple tiles in a grid. Ideal for visualizing device data and controls in a compact format.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: PAGES_TILES_TYPE,
					components: {
						pageAddForm: TilesPageAddForm,
						pageEditForm: TilesPageEditForm,
					},
					schemas: {
						pageSchema: TilesPageSchema,
						pageAddFormSchema: TilesPageAddFormSchema,
						pageEditFormSchema: TilesPageEditFormSchema,
						pageCreateReqSchema: TilesPageCreateReqSchema,
						pageUpdateReqSchema: TilesPageUpdateReqSchema,
					},
				},
			],
			routes: {
				configure: (id: IPage['id']): string | RouteLocationResolvedGeneric => {
					return options.router.resolve({
						name: RouteNames.PAGE,
						params: {
							id,
						},
					});
				},
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
