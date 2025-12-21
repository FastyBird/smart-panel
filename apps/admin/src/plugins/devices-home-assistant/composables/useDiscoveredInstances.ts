import { type Ref, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';

export interface IDiscoveredInstance {
	hostname: string;
	port: number;
	name: string;
	version?: string | null;
	uuid?: string | null;
}

interface DiscoveredInstanceResponse {
	hostname: string;
	port: number;
	name: string;
	version?: string | null;
	uuid?: string | null;
}

interface DiscoveryApiResponse {
	data: DiscoveredInstanceResponse[];
}

export interface IUseDiscoveredInstances {
	instances: Ref<IDiscoveredInstance[]>;
	isLoading: Ref<boolean>;
	error: Ref<string | null>;
	fetchInstances: () => Promise<void>;
	refreshInstances: () => Promise<void>;
}

const instances = ref<IDiscoveredInstance[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export const useDiscoveredInstances = (): IUseDiscoveredInstances => {
	const parseResponse = (responseData: unknown): void => {
		if (responseData && typeof responseData === 'object' && 'data' in responseData) {
			const dataArray = (responseData as DiscoveryApiResponse).data;
			if (Array.isArray(dataArray)) {
				instances.value = dataArray.map((item) => ({
					hostname: item.hostname,
					port: item.port,
					name: item.name,
					version: item.version ?? null,
					uuid: item.uuid ?? null,
				}));
			}
		}
	};

	const fetchInstances = async (): Promise<void> => {
		if (isLoading.value) {
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			// Using fetch directly since the endpoint may not be in generated OpenAPI types yet
			const response = await fetch(`/api/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovery`);
			if (response.ok) {
				const responseData = await response.json();
				parseResponse(responseData);
			}
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to fetch discovered instances';
		} finally {
			isLoading.value = false;
		}
	};

	const refreshInstances = async (): Promise<void> => {
		if (isLoading.value) {
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			// Using fetch directly since the endpoint may not be in generated OpenAPI types yet
			const response = await fetch(`/api/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovery/refresh`, {
				method: 'POST',
			});
			if (response.ok) {
				const responseData = await response.json();
				parseResponse(responseData);
			}
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to refresh discovered instances';
		} finally {
			isLoading.value = false;
		}
	};

	return {
		instances,
		isLoading,
		error,
		fetchInstances,
		refreshInstances,
	};
};
