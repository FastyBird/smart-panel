import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { get as getPath } from 'lodash';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesModbusPluginCreateEndpointOperation,
	DevicesModbusPluginDeleteEndpointOperation,
	DevicesModbusPluginGetEndpointHealthOperation,
	DevicesModbusPluginGetEndpointOperation,
	DevicesModbusPluginGetEndpointsOperation,
	DevicesModbusPluginUpdateEndpointOperation,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_PREFIX } from '../devices-modbus.constants';
import { DevicesModbusApiException, type IDevicesModbusErrorField } from '../devices-modbus.exceptions';

import type { IModbusEndpoint, IModbusEndpointCreate, IModbusEndpointHealth, IModbusEndpointUpdate } from './endpoints.types';
import { transformModbusEndpoint, transformModbusEndpointHealth, transformModbusEndpointRequest } from './modbus.transformers';

const getErrorFields = (error: unknown): IDevicesModbusErrorField[] => {
	const details: unknown = getPath(error, 'error.details', null);

	if (!Array.isArray(details)) {
		return [];
	}

	const fields: IDevicesModbusErrorField[] = [];

	for (const row of details as Record<string, unknown>[]) {
		if (row && typeof row.reason === 'string') {
			fields.push({ field: typeof row.field === 'string' ? row.field : undefined, reason: row.reason });
		}
	}

	return fields;
};

const BASE = `/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/endpoints` as const;

export const useModbusEndpoints = defineStore('devices_modbus_plugin-endpoints', () => {
	const backend = useBackend();
	const data = ref<Record<string, IModbusEndpoint>>({});
	const health = ref<Record<string, IModbusEndpointHealth>>({});

	// Every add, edit and remove gets a number; a list response replaces only the endpoints nobody changed while it
	// was in flight, so a slow list cannot bring back an old name, drop a new endpoint or restore a removed one.
	let mutationCount = 0;
	const lastMutation = new Map<string, number>();

	const markMutated = (id: string): void => {
		lastMutation.set(id, ++mutationCount);
	};

	// Changes to one endpoint run one after another, so their responses arrive in order and the cache always ends
	// with the state of the last change, e.g. when a toggle and an edit of the same endpoint overlap.
	const queues = new Map<string, Promise<unknown>>();

	const enqueue = <T>(id: string, task: () => Promise<T>): Promise<T> => {
		const run = (queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(task);

		queues.set(id, run);

		void run
			.catch(() => undefined)
			.finally(() => {
				if (queues.get(id) === run) {
					queues.delete(id);
				}
			});

		return run;
	};

	const findAll = (): IModbusEndpoint[] => Object.values(data.value);
	const findById = (id: string): IModbusEndpoint | null => data.value[id] ?? null;

	// Only the latest list request replaces the cache; an older one that answers later would bring back old state.
	let latestList = 0;

	const fetch = async (): Promise<IModbusEndpoint[]> => {
		const request = ++latestList;
		const startedAt = mutationCount;
		const { data: responseData, error, response } = await backend.client.GET(BASE);

		if (responseData) {
			const endpoints = responseData.data.map(transformModbusEndpoint);

			if (request !== latestList) {
				return endpoints;
			}

			const next: Record<string, IModbusEndpoint> = Object.fromEntries(endpoints.map((endpoint) => [endpoint.id, endpoint]));

			for (const [id, mutatedAt] of lastMutation) {
				if (mutatedAt <= startedAt) {
					continue;
				}

				if (id in data.value) {
					next[id] = data.value[id];
				} else {
					delete next[id];
				}
			}

			data.value = next;
			health.value = Object.fromEntries(Object.entries(health.value).filter(([id]) => id in data.value));

			return endpoints;
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginGetEndpointsOperation>(error, 'Failed to load the Modbus endpoints.'),
			response.status
		);
	};

	const get = async (id: string): Promise<IModbusEndpoint> => {
		const { data: responseData, error, response } = await backend.client.GET(`${BASE}/{id}`, { params: { path: { id } } });

		if (responseData) {
			return (data.value[id] = transformModbusEndpoint(responseData.data));
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginGetEndpointOperation>(error, 'Failed to load the Modbus endpoint.'),
			response.status
		);
	};

	const add = async (payload: IModbusEndpointCreate): Promise<IModbusEndpoint> => {
		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(BASE, {
			body: { data: transformModbusEndpointRequest(payload) as never },
		});

		if (responseData) {
			markMutated(responseData.data.id);

			return (data.value[responseData.data.id] = transformModbusEndpoint(responseData.data));
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginCreateEndpointOperation>(error, 'Failed to create the Modbus endpoint.'),
			response.status,
			getErrorFields(error)
		);
	};

	const sendEdit = async (id: string, payload: IModbusEndpointUpdate): Promise<IModbusEndpoint> => {
		const {
			data: responseData,
			error,
			response,
		} = await backend.client.PATCH(`${BASE}/{id}`, {
			params: { path: { id } },
			body: { data: transformModbusEndpointRequest(payload) as never },
		});

		if (responseData) {
			markMutated(id);

			return (data.value[id] = transformModbusEndpoint(responseData.data));
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginUpdateEndpointOperation>(error, 'Failed to update the Modbus endpoint.'),
			response.status,
			getErrorFields(error)
		);
	};

	const edit = (id: string, payload: IModbusEndpointUpdate): Promise<IModbusEndpoint> => enqueue(id, () => sendEdit(id, payload));

	const sendRemove = async (id: string): Promise<void> => {
		const { error, response } = await backend.client.DELETE(`${BASE}/{id}`, { params: { path: { id } } });

		if (error) {
			throw new DevicesModbusApiException(
				getErrorReason<DevicesModbusPluginDeleteEndpointOperation>(error, 'Failed to remove the Modbus endpoint.'),
				response.status
			);
		}

		markMutated(id);
		delete data.value[id];
		delete health.value[id];
	};

	const remove = (id: string): Promise<void> => enqueue(id, () => sendRemove(id));

	const requestHealth = async (id: string) => backend.client.GET(`${BASE}/{id}/health`, { params: { path: { id } } });

	const fetchHealth = async (id: string): Promise<IModbusEndpointHealth> => {
		let result: Awaited<ReturnType<typeof requestHealth>>;

		try {
			result = await requestHealth(id);
		} catch (caught: unknown) {
			// The last known state is no longer live; the table renders a missing entry as unknown.
			delete health.value[id];

			throw caught;
		}

		const { data: responseData, error, response } = result;

		if (responseData) {
			return (health.value[id] = transformModbusEndpointHealth(responseData.data));
		}

		// Too many requests says nothing about the endpoint: keep its last known state.
		if (response.status !== 429) {
			delete health.value[id];
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginGetEndpointHealthOperation>(error, 'Failed to load the Modbus endpoint health.'),
			response.status
		);
	};

	return { data, health, findAll, findById, fetch, get, add, edit, remove, fetchHealth };
});

export const registerModbusEndpointsStore = (pinia: Pinia): ReturnType<typeof useModbusEndpoints> => useModbusEndpoints(pinia);
