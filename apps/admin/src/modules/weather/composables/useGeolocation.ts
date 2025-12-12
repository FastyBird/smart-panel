import { ref } from 'vue';

import { useBackend, useLogger } from '../../../common';

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

import type { Ref } from 'vue';

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
			const response = await backend.client.GET('/api/v1/weather-module/geolocation/city-to-coordinates', {
				params: {
					query: {
						city: query,
					},
				},
			});

			if (response.error) {
				logger.error('[WEATHER_MODULE] City search failed:', response.error);
				searchError.value = 'Failed to search for cities';
				return [];
			}

			return (response.data?.data ?? []) as IGeolocationCity[];
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
