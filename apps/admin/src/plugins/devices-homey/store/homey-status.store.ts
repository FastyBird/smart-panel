import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesHomeyPluginGetStatusOperation,
	DevicesHomeyPluginTestConnectionOperation,
	DevicesHomeyPluginTestConnectionRequestSchema,
} from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_PREFIX } from '../devices-homey.constants';
import { DevicesHomeyApiException } from '../devices-homey.exceptions';

import { transformHomeyStatus, transformHomeyTestConnection } from './homey.transformers';
import type { IHomeyStatus, IHomeyTestConnection } from './homey.types';

export const useHomeyStatus = defineStore('devices_homey_plugin-status', () => {
	const backend = useBackend();
	const status = ref<IHomeyStatus | null>(null);
	const lastTest = ref<IHomeyTestConnection | null>(null);
	const fetching = ref(false);
	const testing = ref(false);

	const fetch = async (): Promise<IHomeyStatus> => {
		fetching.value = true;

		try {
			const { data, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/status`);

			if (data) {
				return (status.value = transformHomeyStatus(data.data));
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginGetStatusOperation>(error, 'Failed to load Homey status.'),
				response.status
			);
		} finally {
			fetching.value = false;
		}
	};

	const testConnection = async (payload: DevicesHomeyPluginTestConnectionRequestSchema): Promise<IHomeyTestConnection> => {
		testing.value = true;

		try {
			const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEY_PLUGIN_PREFIX}/test-connection`, {
				body: payload,
			});

			if (data) {
				return (lastTest.value = transformHomeyTestConnection(data.data));
			}

			throw new DevicesHomeyApiException(
				getErrorReason<DevicesHomeyPluginTestConnectionOperation>(error, 'Failed to test the Homey connection.'),
				response.status
			);
		} finally {
			testing.value = false;
		}
	};

	return { status, lastTest, fetching, testing, fetch, testConnection };
});

export const registerHomeyStatusStore = (pinia: Pinia): ReturnType<typeof useHomeyStatus> => useHomeyStatus(pinia);
