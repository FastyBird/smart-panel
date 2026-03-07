import { type Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
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
	const { t } = useI18n();
	const backend = useBackend();

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
			const { data, error: apiError } = await backend.client.GET(
				`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovery` as never,
			);

			if (!apiError) {
				parseResponse(data);
			} else {
				error.value = t('devicesHomeAssistantPlugin.messages.discovery.fetchFailed');
			}
		} catch (err) {
			error.value = err instanceof Error ? err.message : t('devicesHomeAssistantPlugin.messages.discovery.fetchFailed');
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
			const { data, error: apiError } = await backend.client.POST(
				`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovery/refresh` as never,
			);

			if (!apiError) {
				parseResponse(data);
			} else {
				error.value = t('devicesHomeAssistantPlugin.messages.discovery.refreshFailed');
			}
		} catch (err) {
			error.value = err instanceof Error ? err.message : t('devicesHomeAssistantPlugin.messages.discovery.refreshFailed');
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
