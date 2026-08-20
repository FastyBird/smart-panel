import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy, pick } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type {
	DevicesModuleCreateDeviceOperation,
	DevicesModuleCreateDevicesBulkRemoveOperation,
	DevicesModuleCreateDevicesBulkUpdateOperation,
	DevicesModuleDeleteDeviceOperation,
	DevicesModuleGetDeviceOperation,
	DevicesModuleGetDevicesOperation,
	DevicesModuleUpdateDeviceOperation,
} from '../../../openapi.constants';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useChannelsPlugins, useChannelsPropertiesPlugins, useDevicesPlugins } from '../composables/composables';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { DevicesApiException, DevicesException, DevicesValidationException } from '../devices.exceptions';

import { transformChannelControlResponse } from './channels.controls.transformers';
import { ChannelPropertySchema } from './channels.properties.store.schemas';
import { transformChannelPropertyResponse } from './channels.properties.transformers';
import { ChannelSchema } from './channels.store.schemas';
import type { IChannelRes } from './channels.store.types';
import { transformChannelResponse } from './channels.transformers';
import type { IDeviceControlRes } from './devices.controls.store.types';
import { transformDeviceControlResponse } from './devices.controls.transformers';
import {
	DeviceCreateReqSchema,
	DeviceSchema,
	DeviceUpdateReqSchema,
	DevicesAddActionPayloadSchema,
	DevicesBulkResultSchema,
	DevicesEditActionPayloadSchema,
} from './devices.store.schemas';
import type {
	DevicesStoreSetup,
	IDevice,
	IDeviceCreateReq,
	IDeviceRes,
	IDeviceUpdateReq,
	IDevicesAddActionPayload,
	IDevicesAddZoneActionPayload,
	IDevicesBulkRemoveActionPayload,
	IDevicesBulkResult,
	IDevicesBulkSetEnabledActionPayload,
	IDevicesEditActionPayload,
	IDevicesFetchActionPayload,
	IDevicesGetActionPayload,
	IDevicesOnEventActionPayload,
	IDevicesRemoveActionPayload,
	IDevicesRemoveZoneActionPayload,
	IDevicesSaveActionPayload,
	IDevicesSetActionPayload,
	IDevicesStateSemaphore,
	IDevicesStoreActions,
	IDevicesStoreState,
	IDevicesUnsetActionPayload,
} from './devices.store.types';
import { transformDeviceCreateRequest, transformDeviceResponse, transformDeviceUpdateRequest } from './devices.transformers';
import { channelsControlsStoreKey, channelsPropertiesStoreKey, channelsStoreKey, devicesControlsStoreKey } from './keys';

const defaultSemaphore: IDevicesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDevices = defineStore<'devices_module-devices', DevicesStoreSetup>('devices_module-devices', (): DevicesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const { getElement: getPluginElement } = useDevicesPlugins();
	const { getElement: getChannelsPluginElement } = useChannelsPlugins();
	const { getElement: getChannelsPropertiesPluginElement } = useChannelsPropertiesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<IDevicesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IDevice['id']]: IDevice }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IDevice['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IDevice[] => Object.values(data.value);

	const findById = (id: IDevice['id']): IDevice | null => data.value[id] ?? null;

	const pendingGetPromises: Record<string, Promise<IDevice>> = {};

	const pendingFetchPromises: Record<string, Promise<IDevice[]>> = {};

	// Tracks how many `fetch()` calls are in flight right now (across all `hidden` values), so the
	// semaphore is only cleared once every one of them has settled, not just whichever finishes first.
	let inFlightFetchCount = 0;

	// `latestFetchToken` is bumped on *every* `fetch()` call, including one that coalesces onto an
	// already-pending request for the same `hidden` value below — a repeat call still re-affirms that
	// value is the one currently wanted. `latestFetchTokenByKey` remembers, per `hidden` value, the
	// token of the most recent call for that value — so a value that gets re-requested while its first
	// call is still in flight keeps its recorded token current even though no second network call goes
	// out. A response is only applied to `data.value` if its key's recorded token still equals the
	// global latest: true both for a request with no competition, and for one a later call coalesced
	// onto (which re-armed the key's token), false once a *different* key becomes the most recent one.
	// (A single flat token compared against itself is not enough: it would correctly catch a fetch for
	// a different key superseding this one, but not a same-key repeat superseding a same-key original
	// — the repeat takes the cache hit below and never gets a token of its own to be judged against.)
	let latestFetchToken = 0;
	const latestFetchTokenByKey: Record<string, number> = {};

	// Stamped on every write that is not a fetch applying its own response — a websocket event, an
	// optimistic edit, a create, a delete. A fetch remembers the stamp it went out under, so when its
	// response lands it can tell which rows have been written since: for those the snapshot is the
	// older story and must not be applied. The case that made this necessary is the wizard hiding a
	// source device: the list fetch reads the row before the hide, DEVICE_UPDATED applies `hidden:
	// true` while that request is still in flight, and the wholesale replacement then put the visible
	// row back — the physical source rendered beside the virtual device that replaced it until
	// something else happened to refresh it.
	let mutationToken = 0;
	const mutationTokenById: Record<IDevice['id'], number> = {};

	// The two ways a row is written outside a fetch. Everything else in this store goes through them,
	// which is what keeps the stamp complete.
	const commit = (device: IDevice): IDevice => {
		mutationTokenById[device.id] = ++mutationToken;

		return (data.value[device.id] = device);
	};

	const forget = (id: IDevice['id']): void => {
		mutationTokenById[id] = ++mutationToken;

		delete data.value[id];
	};

	const onEvent = (payload: IDevicesOnEventActionPayload): IDevice => {
		const element = getPluginElement(payload.type);

		return set({
			id: payload.id,
			data: transformDeviceResponse(payload.data as IDeviceRes, element?.schemas?.deviceSchema || DeviceSchema),
		});
	};

	const set = (payload: IDevicesSetActionPayload): IDevice => {
		const element = getPluginElement(payload.data.type);

		if (payload.id && data.value && payload.id in data.value) {
			// Strip undefined values so schema defaults from partial WS updates
			// don't overwrite real data already in the store
			const cleaned = omitBy(payload.data, isUndefined);
			const parsed = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({ ...data.value[payload.id], ...cleaned });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DevicesValidationException('Failed to insert device.');
			}

			return commit(parsed.data);
		}

		const parsed = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DevicesValidationException('Failed to insert device.');
		}

		data.value = data.value ?? {};

		return commit(parsed.data);
	};

	const unset = (payload: IDevicesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		forget(payload.id);

		return;
	};

	const get = async (payload: IDevicesGetActionPayload): Promise<IDevice> => {
		const existingPromise = pendingGetPromises[payload.id];
		if (existingPromise) {
			return existingPromise;
		}

		const getPromise = (async (): Promise<IDevice> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DevicesApiException('Already fetching device.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					commit(transformed);

					insertDeviceControlsRelations(transformed, responseData.data.controls);
					insertChannelsRelations(transformed, responseData.data.channels);

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleGetDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
			}
		})();

		pendingGetPromises[payload.id] = getPromise;

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (payload?: IDevicesFetchActionPayload): Promise<IDevice[]> => {
		// Keyed by the requested `hidden` value (not a fixed key): two calls asking for the same thing
		// share one in-flight request, but two calls asking for *different* things — e.g. the device
		// list's mount fetch (hidden=false) still in flight when the "show hidden" toggle flips to
		// hidden=all — must not silently collapse into whichever happened to start first.
		const cacheKey = payload?.hidden ?? 'default';

		// Re-arms this key's recency *before* the coalesce check below, so a repeat call for a key
		// that is still in flight (e.g. the "show hidden" toggle flipping off, on, then off again
		// before the first "off" request has returned) is not silently judged stale once the shared
		// in-flight request it takes a cache hit on eventually resolves.
		latestFetchToken += 1;
		latestFetchTokenByKey[cacheKey] = latestFetchToken;

		const existingPromise = pendingFetchPromises[cacheKey];
		if (existingPromise) {
			return existingPromise;
		}

		inFlightFetchCount += 1;
		semaphore.value.fetching.items = true;

		// Read before the request goes out: every row stamped later than this was written while the
		// server was assembling its answer, so for those rows this response is out of date.
		const requestedAt = mutationToken;

		const fetchPromise = (async (): Promise<IDevice[]> => {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
					params: {
						query: {
							// `all` when the caller did not say, because the answer lands in a cache everything
							// shares and this action *replaces* what is there. The endpoint answers with the
							// visible devices unless told otherwise, so an unscoped refresh — socket-reconnect
							// recovery, or any `useDevices()` consumer — would quietly drop every system-hidden
							// source out from under an open mapping or remap flow, and out of the "show hidden"
							// list. Callers that want only the visible ones filter what they read, which is what
							// `useDevices()` and `useSpaceDevices()` already do; a shared cache that is missing
							// rows cannot be filtered back into completeness.
							hidden: payload?.hidden ?? DevicesModuleDevicesHiddenFilter.all,
						},
					},
				});

				if (typeof responseData !== 'undefined') {
					// Stale only if a call for a *different* key has become the most recently
					// requested one since this request went out. A repeat call for THIS SAME key —
					// even one that coalesced onto this very request instead of starting a new one —
					// already re-armed `latestFetchTokenByKey[cacheKey]` above, so it survives this
					// check; only a genuinely superseded key skips transforming its now-irrelevant
					// response and leaves `data.value` and the related stores exactly as the winning
					// request left them.
					if (latestFetchTokenByKey[cacheKey] !== latestFetchToken) {
						// Answered from this response, not from the cache it is not allowed to write to. The
						// two are different questions — this caller asked for a particular `hidden` scope, the
						// cache now belongs to whichever scope was requested last — and handing back the
						// winning request's contents would be a full-hydration answer to a question it never
						// asked. Onboarding's plugin cleanup acts on exactly that difference: told it holds
						// every device when it holds only the visible ones, it leaves the plugin's hidden
						// devices behind in the database, owned by a plugin that is no longer running.
						//
						// Related stores are left alone for the same reason as `data`: they are the winning
						// request's to fill.
						return responseData.data.map((device) => {
							const element = getPluginElement(device.type);

							return transformDeviceResponse(device, element?.schemas?.deviceSchema || DeviceSchema);
						});
					}

					// Applied row by row rather than assigned wholesale: a row written since `requestedAt`
					// is newer than this snapshot and keeps what it holds — including having been deleted,
					// which is why a stamped id with nothing behind it is dropped rather than restored.
					// Rows the response does not carry are still evicted, which is what makes this a
					// replacement rather than a merge that can only ever grow.
					const applied: { [key: IDevice['id']]: IDevice } = {};

					for (const device of responseData.data) {
						const element = getPluginElement(device.type);

						const transformedDevice = transformDeviceResponse(device, element?.schemas?.deviceSchema || DeviceSchema);

						if ((mutationTokenById[transformedDevice.id] ?? 0) > requestedAt) {
							const local = data.value[transformedDevice.id];

							if (local) {
								applied[transformedDevice.id] = local;
							}

							continue;
						}

						insertDeviceControlsRelations(transformedDevice, device.controls);
						insertChannelsRelations(transformedDevice, device.channels);

						applied[transformedDevice.id] = transformedDevice;
					}

					// Written while the request was in flight and absent from its answer: a device created
					// locally, or one that came into existence after the server read the list.
					for (const [id, token] of Object.entries(mutationTokenById)) {
						if (token > requestedAt && !(id in applied) && data.value[id]) {
							applied[id] = data.value[id];
						}
					}

					data.value = applied;

					firstLoad.value = true;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch devices.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleGetDevicesOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				inFlightFetchCount -= 1;

				if (inFlightFetchCount === 0) {
					semaphore.value.fetching.items = false;
				}
			}
		})();

		pendingFetchPromises[cacheKey] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[cacheKey];
		}
	};

	const add = async (payload: IDevicesAddActionPayload): Promise<IDevice> => {
		const parsedPayload = DevicesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to add device.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedNewItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({
			...payload.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewItem.success) {
			logger.error('Schema validation failed with:', parsedNewItem.error);

			throw new DevicesValidationException('Failed to add device.');
		}

		semaphore.value.creating.push(parsedNewItem.data.id);

		commit(parsedNewItem.data);

		if (parsedNewItem.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

			return parsedNewItem.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
					body: {
						data: transformDeviceCreateRequest<IDeviceCreateReq>(
							parsedNewItem.data,
							element?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					commit(transformed);

					insertDeviceControlsRelations(transformed, responseData.data.controls);
					insertChannelsRelations(transformed, responseData.data.channels);

					return transformed;
				}

				// Record could not be created on api, we have to remove it from a database
				forget(parsedNewItem.data.id);

				let errorReason: string | null = 'Failed to create device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
			}
		}
	};

	const edit = async (payload: IDevicesEditActionPayload): Promise<IDevice> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DevicesException('Failed to get device data to update.');
		}

		const parsedPayload = DevicesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		const element = getPluginElement(payload.data.type);

		// Keys the caller actually supplied (`undefined` means "leave untouched", the same convention
		// the merge below already uses) — this set, not the merged-and-validated record it is checked
		// against, is what is allowed to reach the outgoing PATCH body. See `requestData` below.
		const providedData = omitBy(payload.data, isUndefined);

		const parsedEditedItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse({
			...data.value[payload.id],
			...providedData,
		});

		if (!parsedEditedItem.success) {
			logger.error('Schema validation failed with:', parsedEditedItem.error);

			throw new DevicesValidationException('Failed to edit device.');
		}

		semaphore.value.updating.push(payload.id);

		commit(parsedEditedItem.data);

		if (parsedEditedItem.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

			return parsedEditedItem.data;
		} else {
			try {
				// The merge above exists so validation resolves schema defaults and required fields
				// against a complete record — it must not become the request body itself, or every field
				// the caller left untouched (starting with `roomId`, backfilled from the cached device by
				// `DeviceSchema`'s `.default(null)`) gets silently reinstated and sent as though it had
				// changed. The backend's hidden-device placement guard treats a present `room_id` — `null`
				// included — as a placement change, so a reinstated key here can turn an unrelated rename
				// into a refused request. Only a key the caller actually supplied is allowed onto the wire.
				const requestData = pick(parsedEditedItem.data, Object.keys(providedData)) as typeof parsedEditedItem.data;

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
					body: {
						data: transformDeviceUpdateRequest<IDeviceUpdateReq>(requestData, element?.schemas?.deviceUpdateReqSchema || DeviceUpdateReqSchema),
					},
				});

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

					commit(transformed);

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Failed to update device.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleUpdateDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: IDevicesSaveActionPayload): Promise<IDevice> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DevicesException('Device is already being saved.');
		}

		const deviceToSave = data.value[payload.id];
		if (!deviceToSave) {
			throw new DevicesException('Failed to get device data to save.');
		}

		const element = getPluginElement(deviceToSave.type);

		const parsedSaveItem = (element?.schemas?.deviceSchema || DeviceSchema).safeParse(deviceToSave);

		if (!parsedSaveItem.success) {
			logger.error('Schema validation failed with:', parsedSaveItem.error);

			throw new DevicesValidationException('Failed to save device.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices`, {
				body: {
					data: transformDeviceCreateRequest<IDeviceCreateReq>(parsedSaveItem.data, element?.schemas?.deviceCreateReqSchema || DeviceCreateReqSchema),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const element = getPluginElement(responseData.data.type);

				const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

				commit(transformed);

				insertDeviceControlsRelations(transformed, responseData.data.controls);
				insertChannelsRelations(transformed, responseData.data.channels);

				return transformed;
			}

			let errorReason: string | null = 'Failed to create device.';

			if (error) {
				errorReason = getErrorReason<DevicesModuleCreateDeviceOperation>(error, errorReason);
			}

			throw new DevicesApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const remove = async (payload: IDevicesRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DevicesException('Device is already being removed.');
		}

		if (!Object.keys(data.value).includes(payload.id)) {
			return true;
		}

		semaphore.value.deleting.push(payload.id);

		const recordToRemove = data.value[payload.id];

		forget(payload.id);

		if (recordToRemove?.draft) {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		} else {
			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
				});

				if (response.status === 204) {
					purgeLocally(payload.id);

					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Remove account failed.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleDeleteDeviceOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	/**
	 * Drops a device from this store and every store that hangs off it.
	 *
	 * `remove` did this inline; the bulk paths need the same cascade for each
	 * device the backend confirmed, so it lives here rather than being written
	 * out twice with a chance of drifting apart.
	 */
	const purgeLocally = (id: IDevice['id']): void => {
		const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

		devicesControlsStore.unset({ deviceId: id });

		const channelsStore = storesManager.getStore(channelsStoreKey);
		const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);
		const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

		const channels = channelsStore.findForDevice(id);

		channels.forEach((channel) => {
			channelsControlsStore.unset({ channelId: channel.id });
			channelsPropertiesStore.unset({ channelId: channel.id });
		});

		channelsStore.unset({ deviceId: id });
	};

	/**
	 * Removes a selection in one request.
	 *
	 * The per-device alternative was one request each, which the backend's
	 * shared rate limit rejects past thirty - so a large selection failed
	 * halfway through with no way to tell which half. The outcome is reported
	 * per device because the backend still refuses individual devices for
	 * individual reasons.
	 */
	const bulkRemove = async (payload: IDevicesBulkRemoveActionPayload): Promise<IDevicesBulkResult> => {
		// Drafts were never sent to the backend, so they are dropped here and
		// counted as done rather than being handed to an endpoint that would
		// correctly report them as unknown.
		const drafts: string[] = [];
		const persisted: string[] = [];

		for (const id of payload.ids) {
			const record = data.value[id];

			if (record === undefined) {
				continue;
			}

			(record.draft ? drafts : persisted).push(id);
		}

		for (const id of drafts) {
			forget(id);
			purgeLocally(id);
		}

		if (persisted.length === 0) {
			return { succeeded: drafts, failed: [] };
		}

		semaphore.value.deleting.push(...persisted);

		try {
			const { data: responseBody, error, response } = await backend.client.POST(
				`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/bulk-remove`,
				{ body: { data: { ids: persisted } } }
			);

			if (typeof responseBody === 'undefined' || !response.ok) {
				let errorReason: string | null = 'Remove devices failed.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateDevicesBulkRemoveOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}

			const result = DevicesBulkResultSchema.parse(responseBody.data);

			for (const id of result.succeeded) {
				forget(id);
				purgeLocally(id);
			}

			return { succeeded: [...drafts, ...result.succeeded], failed: result.failed };
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => !persisted.includes(item));
		}
	};

	/**
	 * Enables or disables a selection in one request. Same reasoning as
	 * `bulkRemove`.
	 */
	const bulkSetEnabled = async (payload: IDevicesBulkSetEnabledActionPayload): Promise<IDevicesBulkResult> => {
		const persisted = payload.ids.filter((id) => data.value[id] !== undefined && !data.value[id]!.draft);

		if (persisted.length === 0) {
			return { succeeded: [], failed: [] };
		}

		semaphore.value.updating.push(...persisted);

		try {
			const { data: responseBody, error, response } = await backend.client.POST(
				`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/bulk-update`,
				{ body: { data: { ids: persisted, enabled: payload.enabled } } }
			);

			if (typeof responseBody === 'undefined' || !response.ok) {
				let errorReason: string | null = 'Update devices failed.';

				if (error) {
					errorReason = getErrorReason<DevicesModuleCreateDevicesBulkUpdateOperation>(error, errorReason);
				}

				throw new DevicesApiException(errorReason, response.status);
			}

			const result = DevicesBulkResultSchema.parse(responseBody.data);

			// The response carries only the outcome, so the local records are
			// nudged to the state the backend just confirmed instead of being
			// re-fetched one by one - which would reintroduce the request storm
			// this endpoint exists to remove.
			for (const id of result.succeeded) {
				const record = data.value[id];

				if (record !== undefined) {
					commit({ ...record, enabled: payload.enabled });
				}
			}

			return result;
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => !persisted.includes(item));
		}
	};

	const addZone = async (payload: IDevicesAddZoneActionPayload): Promise<IDevice> => {
		const device = data.value[payload.id];

		if (!device) {
			throw new DevicesException(`Device [${payload.id}] not found.`);
		}

		semaphore.value.updating.push(payload.id);

		try {
			const { response } = await backend.client.POST(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}/zones/{zoneId}`, {
				params: {
					path: {
						id: payload.id,
						zoneId: payload.zoneId,
					},
				},
			});

			if (!response.ok) {
				throw new DevicesApiException('Failed to add device to zone.', response.status);
			}

			// Re-fetch the device to update store with new zoneIds
			return await get({ id: payload.id });
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const removeZone = async (payload: IDevicesRemoveZoneActionPayload): Promise<IDevice> => {
		const device = data.value[payload.id];

		if (!device) {
			throw new DevicesException(`Device [${payload.id}] not found.`);
		}

		semaphore.value.updating.push(payload.id);

		try {
			const { response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DEVICES_MODULE_PREFIX}/devices/{id}/zones/{zoneId}`, {
				params: {
					path: {
						id: payload.id,
						zoneId: payload.zoneId,
					},
				},
			});

			if (!response.ok) {
				throw new DevicesApiException('Failed to remove device from zone.', response.status);
			}

			// Re-fetch the device to update store with new zoneIds
			return await get({ id: payload.id });
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const insertDeviceControlsRelations = (device: IDevice, controls: IDeviceControlRes[]): void => {
		const devicesControlsStore = storesManager.getStore(devicesControlsStoreKey);

		controls.forEach((control) => {
			devicesControlsStore.set({
				id: control.id,
				data: transformDeviceControlResponse(control),
			});
		});

		devicesControlsStore.firstLoad.push(device.id);
	};

	const insertChannelsRelations = (device: IDevice, channels: IChannelRes[]): void => {
		const channelsStore = storesManager.getStore(channelsStoreKey);
		const channelsControlsStore = storesManager.getStore(channelsControlsStoreKey);
		const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

		channels.forEach((channel) => {
			const element = getChannelsPluginElement(channel.type);

			channelsStore.set({
				id: channel.id,
				data: transformChannelResponse(channel, element?.schemas?.channelSchema || ChannelSchema),
			});

			channel.controls.forEach((control) => {
				channelsControlsStore.set({
					id: control.id,
					data: transformChannelControlResponse(control),
				});
			});

			channelsControlsStore.firstLoad.push(channel.id);

			channel.properties.forEach((property) => {
				const element = getChannelsPropertiesPluginElement(property.type);

				channelsPropertiesStore.set({
					id: property.id,
					data: transformChannelPropertyResponse(property, element?.schemas?.channelPropertySchema || ChannelPropertySchema),
				});
			});

			channelsPropertiesStore.firstLoad.push(channel.id);
		});

		channelsStore.firstLoad.push(device.id);
	};

	// Reconnect refresh contract: the store itself says whether it holds anything worth
	// re-reading, so the caller never has to guess from a flag it does not maintain.
	const isLoaded = (): boolean => firstLoadFinished() || findAll().length > 0;

	// Refreshes with `all`, not with the endpoint's default. A bare `fetch()` sends no filter, which
	// the endpoint reads as "visible only", so a reconnect refresh would replace the shared collection
	// with visible devices — silently emptying the device list's own "Show hidden" view and dropping
	// the system-hidden source out of a mapping flow the operator has open. Every consumer that cares
	// filters the collection it renders, so the widest fetch is the safe one to restore from.
	const refresh = (): Promise<unknown> => fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

	return {
		isLoaded,
		refresh,
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findById,
		onEvent,
		set,
		unset,
		get,
		fetch,
		add,
		edit,
		save,
		remove,
		bulkRemove,
		bulkSetEnabled,
		addZone,
		removeZone,
	};
});

export const registerDevicesStore = (pinia: Pinia): Store<string, IDevicesStoreState, object, IDevicesStoreActions> => {
	return useDevices(pinia);
};
