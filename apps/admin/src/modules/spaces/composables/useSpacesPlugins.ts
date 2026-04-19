import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
import { useConfigPlugins } from '../../config';
import { SPACES_MODULE_NAME } from '../spaces.constants';
import type { ISpacePluginRoutes, ISpacePluginsComponents, ISpacePluginsSchemas } from '../spaces.types';

import type { IUseSpacesPlugins } from './types';

export const useSpacesPlugins = (): IUseSpacesPlugins => {
	const pluginsManager = injectPluginsManager();

	const { enabled } = useConfigPlugins();

	const pluginComponents: (keyof ISpacePluginsComponents)[] = ['spaceDetail', 'spaceAddForm', 'spaceEditForm'];

	const pluginSchemas: (keyof ISpacePluginsSchemas)[] = [
		'spaceSchema',
		'spaceAddFormSchema',
		'spaceEditFormSchema',
		'spaceCreateReqSchema',
		'spaceUpdateReqSchema',
	];

	const pluginRoutes: (keyof ISpacePluginRoutes)[] = [];

	const plugins = computed<IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes>[]>(() => {
		return pluginsManager.getPlugins().filter((plugin) => {
			const pluginModuleEligible = plugin.modules === undefined || plugin.modules.includes(SPACES_MODULE_NAME);

			if (!pluginModuleEligible) {
				return false;
			}

			const hasRoute = pluginRoutes.length === 0 || pluginRoutes.some((key) => plugin.routes && key in plugin.routes);

			return (plugin.elements ?? []).some((el) => {
				const elementModuleEligible = el.modules === undefined || el.modules.includes(SPACES_MODULE_NAME);

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
					.filter((el) => el.modules === undefined || el.modules.includes(SPACES_MODULE_NAME))
					.map((el) => ({
						value: el.type,
						label: el.name?.trim() ? el.name : plugin.name,
						disabled: !enabled(plugin.type),
					}));
			});

			return orderBy(flat, [(o) => o.label], ['asc']);
		}
	);

	const getByName = (type: IPlugin['type']): IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getByType = (type: IPluginElement['type']): IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined => {
		return plugins.value.find((plugin) =>
			(plugin.elements ?? []).some((el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(SPACES_MODULE_NAME)))
		);
	};

	const getElement = (type: IPluginElement['type']): IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined => {
		for (const plugin of plugins.value) {
			const element = (plugin.elements ?? []).find(
				(el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(SPACES_MODULE_NAME))
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
