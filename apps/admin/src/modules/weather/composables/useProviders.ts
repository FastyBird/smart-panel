import { ref, computed } from 'vue';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { WEATHER_MODULE_PREFIX } from '../weather.constants';

export interface IWeatherProvider {
	type: string;
	name: string;
	description: string;
}

interface IWeatherProviderRes {
	type: string;
	name: string;
	description: string;
}

interface IUseProviders {
	providers: ReturnType<typeof computed<IWeatherProvider[]>>;
	isLoading: ReturnType<typeof ref<boolean>>;
	error: ReturnType<typeof ref<string | null>>;
	fetchProviders: () => Promise<IWeatherProvider[]>;
}

export const useProviders = (): IUseProviders => {
	const backend = useBackend();
	const logger = useLogger();

	const providersData = ref<IWeatherProvider[]>([]);
	const isLoading = ref<boolean>(false);
	const error = ref<string | null>(null);

	const providers = computed<IWeatherProvider[]>(() => providersData.value);

	const fetchProviders = async (): Promise<IWeatherProvider[]> => {
		if (isLoading.value) {
			return providersData.value;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const response = await backend.client.GET(`/${WEATHER_MODULE_PREFIX}/providers`);

			const responseData = response.data as { data: IWeatherProviderRes[] } | undefined;

			if (typeof responseData !== 'undefined') {
				providersData.value = responseData.data.map((p) => ({
					type: p.type,
					name: p.name,
					description: p.description,
				}));

				return providersData.value;
			}

			throw new Error('Received invalid response');
		} catch (err: unknown) {
			const errorReason = getErrorReason(err);

			logger.error('[WEATHER_MODULE] Failed to fetch providers:', errorReason);
			error.value = errorReason;

			return [];
		} finally {
			isLoading.value = false;
		}
	};

	return {
		providers,
		isLoading,
		error,
		fetchProviders,
	};
};
