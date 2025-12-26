import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { DISPLAYS_MODULE_PREFIX } from '../displays.constants';
import { DisplaysApiException, DisplaysException, DisplaysValidationException } from '../displays.exceptions';

import { DisplaySchema, DisplaysAddActionPayloadSchema, DisplaysEditActionPayloadSchema } from './displays.store.schemas';
import type {
	DisplaysStoreSetup,
	IDisplay,
	IDisplayRes,
	IDisplayToken,
	IDisplaysAddActionPayload,
	IDisplaysEditActionPayload,
	IDisplaysGetActionPayload,
	IDisplaysOnEventActionPayload,
	IDisplaysRemoveActionPayload,
	IDisplaysRevokeTokenActionPayload,
	IDisplaysSaveActionPayload,
	IDisplaysSetActionPayload,
	IDisplaysStateSemaphore,
	IDisplaysStoreActions,
	IDisplaysStoreState,
	IDisplaysUnsetActionPayload,
} from './displays.store.types';
import { transformDisplayCreateRequest, transformDisplayResponse, transformDisplayUpdateRequest } from './displays.transformers';

const defaultSemaphore: IDisplaysStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDisplays = defineStore<'displays_module-displays', DisplaysStoreSetup>('displays_module-displays', (): DisplaysStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<IDisplaysStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IDisplay['id']]: IDisplay }>({});

	const tokenRefreshTriggers = ref<{ [key: IDisplay['id']]: number }>({});

	const pendingGetPromises: Record<IDisplay['id'], Promise<IDisplay>> = {};

	const pendingFetchPromises: Record<string, Promise<IDisplay[]>> = {};

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IDisplay['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IDisplay[] => Object.values(data.value);

	const findById = (id: IDisplay['id']): IDisplay | null => (id in data.value ? data.value[id] : null);

	const onEvent = (payload: IDisplaysOnEventActionPayload): IDisplay => {
		return set({
			id: payload.id,
			data: transformDisplayResponse(payload.data as unknown as IDisplayRes),
		});
	};

	const set = (payload: IDisplaysSetActionPayload): IDisplay => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsed = DisplaySchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DisplaysValidationException('Failed to insert display.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = DisplaySchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DisplaysValidationException('Failed to insert display.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: IDisplaysUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IDisplaysGetActionPayload): Promise<IDisplay> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const getPromise = (async (): Promise<IDisplay> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DisplaysApiException('Already fetching display.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				if (typeof responseData !== 'undefined') {
					const display = transformDisplayResponse(responseData.data as IDisplayRes);

					data.value[display.id] = display;

					return display;
				}

				const errorReason: string | null = error ? 'Failed to fetch display.' : 'Failed to fetch display.';

				throw new DisplaysApiException(errorReason, response.status);
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

	const fetch = async (): Promise<IDisplay[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IDisplay[]> => {
			if (semaphore.value.fetching.items) {
				throw new DisplaysApiException('Already fetching displays.');
			}

			semaphore.value.fetching.items = true;

			try {
				const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays`);

				if (typeof responseData !== 'undefined') {
					data.value = Object.fromEntries(
						responseData.data.map((display: IDisplayRes) => {
							const transformedDisplay = transformDisplayResponse(display);

							return [transformedDisplay.id, transformedDisplay];
						})
					);

					firstLoad.value = true;

					return Object.values(data.value);
				}

				const errorReason: string | null = error ? 'Failed to fetch displays.' : 'Failed to fetch displays.';

				throw new DisplaysApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = false;
			}
		})();

		pendingFetchPromises['all'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises['all'];
		}
	};

	const add = async (payload: IDisplaysAddActionPayload): Promise<IDisplay> => {
		const parsedPayload = DisplaysAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DisplaysValidationException('Failed to add display.');
		}

		const parsedNewDisplay = DisplaySchema.safeParse({
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewDisplay.success) {
			logger.error('Schema validation failed with:', parsedNewDisplay.error);

			throw new DisplaysValidationException('Failed to add display.');
		}

		semaphore.value.creating.push(parsedNewDisplay.data.id);

		data.value[parsedNewDisplay.data.id] = parsedNewDisplay.data;

		if (parsedNewDisplay.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDisplay.data.id);

			return parsedNewDisplay.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/register`, {
					params: {
						header: {
							'user-agent': 'FastyBird Smart Panel Admin',
						},
					},
					body: {
						data: transformDisplayCreateRequest({ ...parsedNewDisplay.data, ...{ id: payload.id } }),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.display.id === payload.id) {
					const display = transformDisplayResponse(responseData.data.display as IDisplayRes);

					data.value[display.id] = display;

					return display;
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewDisplay.data.id];

				const errorReason: string | null = error ? 'Failed to create display.' : 'Failed to create display.';

				throw new DisplaysApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDisplay.data.id);
			}
		}
	};

	const edit = async (payload: IDisplaysEditActionPayload): Promise<IDisplay> => {
		const parsedPayload = DisplaysEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DisplaysValidationException('Failed to edit display.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DisplaysException('Display is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DisplaysException('Failed to get display data to update.');
		}

		const parsedEditedDisplay = DisplaySchema.safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedDisplay.success) {
			logger.error('Schema validation failed with:', parsedEditedDisplay.error);

			throw new DisplaysValidationException('Failed to edit display.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedDisplay.data.id] = parsedEditedDisplay.data;

		if (parsedEditedDisplay.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedDisplay.data.id);

			return parsedEditedDisplay.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
					body: {
						data: transformDisplayUpdateRequest(parsedEditedDisplay.data),
					},
				});

				if (typeof responseData !== 'undefined') {
					const display = transformDisplayResponse(responseData.data as IDisplayRes);

					data.value[display.id] = display;

					return display;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				const errorReason: string | null = error ? 'Failed to update display.' : 'Failed to update display.';

				throw new DisplaysApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: IDisplaysSaveActionPayload): Promise<IDisplay> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DisplaysException('Display is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DisplaysException('Failed to get display data to save.');
		}

		const parsedSaveDisplay = DisplaySchema.safeParse(data.value[payload.id]);

		if (!parsedSaveDisplay.success) {
			logger.error('Schema validation failed with:', parsedSaveDisplay.error);

			throw new DisplaysValidationException('Failed to save display.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/register`, {
				params: {
					header: {
						'user-agent': 'FastyBird Smart Panel Admin',
					},
				},
				body: {
					data: transformDisplayCreateRequest({ ...parsedSaveDisplay.data, ...{ id: payload.id } }),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.display.id === payload.id) {
				const display = transformDisplayResponse(responseData.data.display as IDisplayRes);

				data.value[display.id] = display;

				return display;
			}

			const errorReason: string | null = error ? 'Failed to create display.' : 'Failed to create display.';

			throw new DisplaysApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const remove = async (payload: IDisplaysRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DisplaysException('Display is already being removed.');
		}

		if (!Object.keys(data.value).includes(payload.id)) {
			return true;
		}

		semaphore.value.deleting.push(payload.id);

		const recordToRemove = data.value[payload.id];

		delete data.value[payload.id];

		if (recordToRemove.draft) {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		} else {
			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
				});

				if (response.status === 204) {
					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				const errorReason: string | null = error ? 'Remove display failed.' : 'Remove display failed.';

				throw new DisplaysApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	const getTokens = async (payload: IDisplaysGetActionPayload): Promise<IDisplayToken[]> => {
		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays/{id}/tokens`, {
				params: {
					path: { id: payload.id },
				},
			});

			if (typeof responseData !== 'undefined') {
				// Transform the response to match our token type
				return responseData.data.map((token: unknown) => {
					const t = token as Record<string, unknown>;
					return {
						id: t.id as string,
						owner_type: t.owner_type as string,
						owner_id: t.owner_id as string | null,
						name: t.name as string,
						description: t.description as string | null,
						expires_at: t.expires_at as string | null,
						revoked: t.revoked as boolean,
						created_at: t.created_at as string,
						updated_at: (t.updated_at as string | null) ?? null,
					};
				});
			}

			const errorReason: string | null = error ? 'Failed to fetch display tokens.' : 'Failed to fetch display tokens.';

			throw new DisplaysApiException(errorReason, response.status);
		} catch (e) {
			if (e instanceof DisplaysApiException) {
				throw e;
			}
			throw new DisplaysApiException('Failed to fetch display tokens.');
		}
	};

	const revokeToken = async (payload: IDisplaysRevokeTokenActionPayload): Promise<boolean> => {
		try {
			const { response } = await backend.client.POST(`/${MODULES_PREFIX}/${DISPLAYS_MODULE_PREFIX}/displays/{id}/revoke-token`, {
				params: {
					path: { id: payload.id },
				},
			});

			if (response.status === 204) {
				// Trigger token refresh for this display
				refreshTokensForDisplay({ id: payload.id });
				return true;
			}

			throw new DisplaysApiException('Failed to revoke display token.', response.status);
		} catch (e) {
			if (e instanceof DisplaysApiException) {
				throw e;
			}
			throw new DisplaysApiException('Failed to revoke display token.');
		}
	};

	const refreshTokensForDisplay = (payload: IDisplaysGetActionPayload): void => {
		// Update the refresh trigger to notify composables that tokens need to be refreshed
		tokenRefreshTriggers.value = {
			...tokenRefreshTriggers.value,
			[payload.id]: (tokenRefreshTriggers.value[payload.id] ?? 0) + 1,
		};
	};

	return {
		semaphore,
		firstLoad,
		data,
		tokenRefreshTriggers,
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
		getTokens,
		revokeToken,
		refreshTokensForDisplay,
	};
});

export const registerDisplaysStore = (pinia: Pinia): Store<string, IDisplaysStoreState, object, IDisplaysStoreActions> => {
	return useDisplays(pinia);
};
