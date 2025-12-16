import { type Ref, ref } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';

interface IGeolocationCity {
	name: string;
	local_names?: Record<string, string>;
	lat: number;
	lon: number;
	country: string;
	state?: string;
}

interface IUseGeolocation {
	searchCities: (query: string) => Promise<IGeolocationCity[]>;
	isSearching: Ref<boolean>;
	searchError: Ref<string | null>;
}

interface IGeolocationResponse {
	data: IGeolocationCity[];
}

export const useGeolocation = (): IUseGeolocation => {
	const backend = useBackend();
	const logger = useLogger();

	const isSearching = ref<boolean>(false);
	const searchError = ref<string | null>(null);

	const searchCities = async (query: string): Promise<IGeolocationCity[]> => {
		if (!query || query.length < 2) {
			return [];
		}

		isSearching.value = true;
		searchError.value = null;

		try {
			const response = await backend.client.GET(`/${WEATHER_MODULE_PREFIX}/geolocation/city-to-coordinates` as never, {
				params: {
					query: {
						city: query,
					},
				},
			} as never);

			const typedResponse = response as { data?: IGeolocationResponse; error?: unknown };

			if (typedResponse.error) {
				logger.error('[WEATHER_MODULE] City search failed:', typedResponse.error);
				searchError.value = 'Failed to search for cities';
				return [];
			}

			return typedResponse.data?.data ?? [];
		} catch (error) {
			logger.error('[WEATHER_MODULE] City search error:', error);
			searchError.value = 'An error occurred while searching';
			return [];
		} finally {
			isSearching.value = false;
		}
	};

	return {
		searchCities,
		isSearching,
		searchError,
	};
};

export type { IGeolocationCity };
