import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
import { useConfigPlugins } from '../../config';
import { SCENES_MODULE_NAME } from '../scenes.constants';
import type { ISceneActionPluginsComponents, ISceneActionPluginsSchemas } from '../scenes.types';

import type { IUseScenesActionPlugins } from './types';

export const useScenesActionPlugins = (): IUseScenesActionPlugins => {
	const pluginsManager = injectPluginsManager();

	const { enabled } = useConfigPlugins();

	const pluginComponents: (keyof ISceneActionPluginsComponents)[] = ['sceneActionAddForm', 'sceneActionEditForm', 'sceneActionCard'];

	const pluginSchemas: (keyof ISceneActionPluginsSchemas)[] = [
		'sceneActionSchema',
		'sceneActionAddFormSchema',
		'sceneActionEditFormSchema',
		'sceneActionCreateReqSchema',
		'sceneActionUpdateReqSchema',
	];

	const plugins = computed<IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas>[]>(() => {
		return pluginsManager.getPlugins().filter((plugin) => {
			const pluginModuleEligible = plugin.modules === undefined || plugin.modules.includes(SCENES_MODULE_NAME);

			if (!pluginModuleEligible) {
				return false;
			}

			return (plugin.elements ?? []).some((el) => {
				const elementModuleEligible = el.modules === undefined || el.modules.includes(SCENES_MODULE_NAME);

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
					.filter((el) => {
						const elementModuleEligible = el.modules === undefined || el.modules.includes(SCENES_MODULE_NAME);
						const hasComponent = !!el.components && pluginComponents.some((key) => el.components && key in el.components);
						return elementModuleEligible && hasComponent;
					})
					.map((el) => ({
						value: el.type,
						label: el.name?.trim() ? el.name : plugin.name,
						disabled: !enabled(plugin.type),
					}));
			});

			return orderBy(flat, [(o) => o.label], ['asc']);
		}
	);

	const getByName = (type: IPlugin['type']): IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getByType = (type: IPluginElement['type']): IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) =>
			(plugin.elements ?? []).some((el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(SCENES_MODULE_NAME)))
		);
	};

	const getElement = (type: IPluginElement['type']): IPluginElement<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined => {
		for (const plugin of plugins.value) {
			const element = (plugin.elements ?? []).find(
				(el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(SCENES_MODULE_NAME))
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
