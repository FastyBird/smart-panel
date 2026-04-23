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

			// Routes are a plugin-level contract — the map of named routes lives on the
			// plugin, not on each element. When pluginRoutes is empty this check is a
			// no-op (space plugins currently declare no routes); the lookup stays so
			// future route contributions short-circuit the include-this-plugin decision
			// regardless of whether any element contributes components or schemas.
			const hasRoute = pluginRoutes.length > 0 && pluginRoutes.some((key) => plugin.routes && key in plugin.routes);

			if (hasRoute) {
				return true;
			}

			// Otherwise the plugin is included iff at least one of its elements is
			// module-eligible AND contributes a requested component or schema.
			return (plugin.elements ?? []).some((el) => {
				const elementModuleEligible = el.modules === undefined || el.modules.includes(SPACES_MODULE_NAME);

				if (!elementModuleEligible) {
					return false;
				}

				const hasComponent =
					pluginComponents.length === 0 || (!!el.components && pluginComponents.some((key) => el.components && key in el.components));

				const hasSchema = pluginSchemas.length === 0 || (!!el.schemas && pluginSchemas.some((key) => el.schemas && key in el.schemas));

				return hasComponent || hasSchema;
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

	const getByPluginType = (type: IPlugin['type']): IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined => {
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
		getByPluginType,
		getByType,
		getElement,
	};
};
