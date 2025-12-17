import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import type { ILocationPluginsComponents, ILocationPluginsSchemas } from '../weather.types';

import type { IUseWeatherLocationsPlugin } from './types';
import { useWeatherLocationsPlugins } from './useWeatherLocationsPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useWeatherLocationsPlugin = ({ type }: IUsePluginProps): IUseWeatherLocationsPlugin => {
	const { getByType } = useWeatherLocationsPlugins();

	const plugin = computed<IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined>(
		(): IPlugin<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined>(
		(): IPluginElement<ILocationPluginsComponents, ILocationPluginsSchemas> | undefined => {
			return (plugin.value?.elements ?? []).find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(WEATHER_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
