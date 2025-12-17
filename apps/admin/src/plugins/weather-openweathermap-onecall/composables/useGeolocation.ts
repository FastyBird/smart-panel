import { ref } from 'vue';

import { useBackend } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_PREFIX } from '../weather-openweathermap-onecall.constants';

export interface IGeolocationCity {
	name: string;
	localNames?: Record<string, string>;
	lat: number;
	lon: number;
	country: string;
	state?: string;
}

interface IGeolocationCityResponse {
	data: IGeolocationCity[];
}

export interface IUseGeolocation {
	searchCities: (query: string) => Promise<IGeolocationCity[]>;
	isSearching: ReturnType<typeof ref<boolean>>;
}

export const useGeolocation = (): IUseGeolocation => {
	const backend = useBackend();

	const isSearching = ref<boolean>(false);

	const searchCities = async (query: string): Promise<IGeolocationCity[]> => {
		if (!query || query.length < 2) {
			return [];
		}

		isSearching.value = true;

		try {
			const { data: responseData, response } = await backend.client.GET(
				`/${PLUGINS_PREFIX}/${WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_PREFIX}/geolocation/city-to-coordinates`,
				{
					params: {
						query: {
							city: query,
						},
					},
				}
			);

			if (response.ok && responseData) {
				const typedResponse = responseData as unknown as IGeolocationCityResponse;
				return typedResponse.data || [];
			}

			return [];
		} catch {
			return [];
		} finally {
			isSearching.value = false;
		}
	};

	return {
		searchCities,
		isSearching,
	};
};
