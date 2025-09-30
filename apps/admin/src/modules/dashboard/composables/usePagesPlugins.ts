import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
import { useConfigPlugins } from '../../config';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';

import type { IUsePagesPlugins } from './types';

export const usePagesPlugins = (): IUsePagesPlugins => {
	const pluginsManager = injectPluginsManager();

	const { enabled } = useConfigPlugins();

	const pluginComponents: (keyof IPagePluginsComponents)[] = ['pageDetail', 'pageAddForm', 'pageEditForm'];

	const pluginSchemas: (keyof IPagePluginsSchemas)[] = [
		'pageSchema',
		'pageAddFormSchema',
		'pageEditFormSchema',
		'pageCreateReqSchema',
		'pageUpdateReqSchema',
	];

	const pluginRoutes: (keyof IPagePluginRoutes)[] = ['configure'];

	const plugins = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>[]>(() => {
		return pluginsManager.getPlugins().filter((plugin) => {
			const pluginModuleEligible = plugin.modules === undefined || plugin.modules.includes(DASHBOARD_MODULE_NAME);

			if (!pluginModuleEligible) {
				return false;
			}

			const hasRoute = pluginRoutes.some((key) => plugin.routes && key in plugin.routes) ?? true;

			return (plugin.elements ?? []).some((el) => {
				const elementModuleEligible = el.modules === undefined || el.modules.includes(DASHBOARD_MODULE_NAME);

				if (!elementModuleEligible) {
					return false;
				}

				const hasComponent =
					pluginComponents.length === 0 || (!!el.components && pluginComponents.some((key) => el.components && key in el.components));

				const hasSchema = pluginSchemas.length === 0 || (!!el.schemas && pluginSchemas.some((key) => el.schemas && key in el.schemas));

				return hasComponent || hasSchema || hasRoute;
			});
		});
	});

	const options = computed<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>(
		(): { value: IPluginElement['type']; label: string; disabled: boolean }[] => {
			const flat: { value: IPluginElement['type']; label: string; disabled: boolean }[] = plugins.value.flatMap((plugin) => {
				return (plugin.elements ?? [])
					.filter((el) => el.modules === undefined || el.modules.includes(DASHBOARD_MODULE_NAME))
					.map((el) => ({
						value: el.type,
						label: el.name?.trim() ? el.name : plugin.name,
						disabled: !enabled(plugin.type),
					}));
			});

			return orderBy(flat, [(o) => o.label], ['asc']);
		}
	);

	const getByName = (type: IPlugin['type']): IPlugin<IPagePluginsComponents, IPagePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getByType = (type: IPluginElement['type']): IPlugin<IPagePluginsComponents, IPagePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) =>
			(plugin.elements ?? []).some((el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(DASHBOARD_MODULE_NAME)))
		);
	};

	const getElement = (type: IPluginElement['type']): IPluginElement<IPagePluginsComponents, IPagePluginsSchemas> | undefined => {
		for (const plugin of plugins.value) {
			const element = (plugin.elements ?? []).find(
				(el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(DASHBOARD_MODULE_NAME))
			);

			if (element) {
				return element;
			}
		}

		return undefined;
	};

	return {
		plugins,
		options,
		getByName,
		getByType,
		getElement,
	};
};
