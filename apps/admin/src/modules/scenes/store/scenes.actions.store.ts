import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesApiException, ScenesException, ScenesValidationException } from '../scenes.exceptions';

import {
	SceneActionCreateReqSchema,
	SceneActionSchema,
	SceneActionUpdateReqSchema,
	ScenesActionsAddActionPayloadSchema,
	ScenesActionsEditActionPayloadSchema,
} from './scenes.actions.store.schemas';
import type {
	ScenesActionsStoreSetup,
	ISceneAction,
	ISceneActionCreateReq,
	ISceneActionRes,
	ISceneActionUpdateReq,
	IScenesActionsAddActionPayload,
	IScenesActionsEditActionPayload,
	IScenesActionsFetchActionPayload,
	IScenesActionsGetActionPayload,
	IScenesActionsOnEventActionPayload,
	IScenesActionsRemoveActionPayload,
	IScenesActionsSaveActionPayload,
	IScenesActionsSetActionPayload,
	IScenesActionsStateSemaphore,
	IScenesActionsStoreActions,
	IScenesActionsStoreState,
	IScenesActionsUnsetActionPayload,
} from './scenes.actions.store.types';
import { transformSceneActionResponse } from './scenes.actions.transformers';
import type { IScene } from './scenes.store.types';

const defaultSemaphore: IScenesActionsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useScenesActionsStore = defineStore<'scenes_module-scenes_actions', ScenesActionsStoreSetup>(
	'scenes_module-scenes_actions',
	(): ScenesActionsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IScenesActionsStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<IScene['id'][]>([]);

		const data = ref<{ [key: ISceneAction['id']]: ISceneAction }>({});

		const firstLoadFinished = (sceneId: IScene['id']): boolean => firstLoad.value.includes(sceneId);

		const getting = (id: ISceneAction['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (sceneId: IScene['id']): boolean => semaphore.value.fetching.items.includes(sceneId);

		const findAll = (): ISceneAction[] => Object.values(data.value);

		const findForScene = (sceneId: IScene['id']): ISceneAction[] =>
			Object.values(data.value ?? {})
				.filter((action: ISceneAction): boolean => action.scene === sceneId)
				.sort((a, b) => a.order - b.order);

		const findById = (id: ISceneAction['id']): ISceneAction | null => (id in data.value ? data.value[id] : null);

		const pendingGetPromises: Record<string, Promise<ISceneAction>> = {};

		const pendingFetchPromises: Record<string, Promise<ISceneAction[]>> = {};

		const onEvent = (payload: IScenesActionsOnEventActionPayload): ISceneAction => {
			return set({
				id: payload.id,
				data: transformSceneActionResponse(payload.data as unknown as ISceneActionRes),
			});
		};

		const set = (payload: IScenesActionsSetActionPayload): ISceneAction => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = SceneActionSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new ScenesValidationException('Failed to insert scene action.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = SceneActionSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ScenesValidationException('Failed to insert scene action.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IScenesActionsUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			if (payload.sceneId !== undefined) {
				const items = findForScene(payload.sceneId);

				for (const item of items) {
					if (item.id in (data.value ?? {})) {
						delete (data.value ?? {})[item.id];
					}
				}

				return;
			} else if (payload.id !== undefined) {
				delete data.value[payload.id];

				return;
			}

			throw new ScenesException('You have to provide at least scene or action id');
		};

		const get = async (payload: IScenesActionsGetActionPayload): Promise<ISceneAction> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<ISceneAction> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new ScenesApiException('Already fetching scene action.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions/{id}`, {
						params: {
							path: { sceneId: payload.sceneId, id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformSceneActionResponse(responseData.data);

						data.value[transformed.id] = transformed;

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch scene action.';

					if (error) {
						if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
					}

					throw new ScenesApiException(errorReason, response.status);
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

		const fetch = async (payload: IScenesActionsFetchActionPayload): Promise<ISceneAction[]> => {
			if (payload.sceneId && payload.sceneId in pendingFetchPromises) {
				return pendingFetchPromises[payload.sceneId];
			}

			const fetchPromise = (async (): Promise<ISceneAction[]> => {
				if (semaphore.value.fetching.items.includes(payload.sceneId)) {
					throw new ScenesApiException('Already fetching actions.');
				}

				semaphore.value.fetching.items.push(payload.sceneId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.sceneId);
				firstLoad.value = [...new Set(firstLoad.value)];

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions`, {
						params: {
							path: { sceneId: payload.sceneId },
						},
					});

					if (typeof responseData !== 'undefined') {
						firstLoad.value.push(payload.sceneId);
						firstLoad.value = [...new Set(firstLoad.value)];

						const actions = Object.fromEntries(
							responseData.data.map((action) => {
								const transformed = transformSceneActionResponse(action);

								return [transformed.id, transformed];
							})
						);

						data.value = { ...data.value, ...actions };

						return findForScene(payload.sceneId);
					}

					let errorReason: string | null = 'Failed to fetch scene actions.';

					if (error) {
						if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
					}

					throw new ScenesApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.sceneId);
				}
			})();

			pendingFetchPromises[payload.sceneId] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises[payload.sceneId];
			}
		};

		const add = async (payload: IScenesActionsAddActionPayload): Promise<ISceneAction> => {
			const parsedPayload = ScenesActionsAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ScenesValidationException('Failed to add action.');
			}

			const parsedNewItem = SceneActionSchema.safeParse({
				...payload.data,
				id: parsedPayload.data.id,
				scene: parsedPayload.data.sceneId,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewItem.success) {
				logger.error('Schema validation failed with:', parsedNewItem.error);

				throw new ScenesValidationException('Failed to add scene action.');
			}

			semaphore.value.creating.push(parsedNewItem.data.id);

			data.value[parsedNewItem.data.id] = parsedNewItem.data;

			if (parsedNewItem.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

				return parsedNewItem.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.POST(`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions`, {
						params: {
							path: { sceneId: payload.sceneId },
						},
						body: {
							data: transformSceneActionCreateRequest(parsedNewItem.data),
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformSceneActionResponse(responseData.data);

						// Remove the temporary client-side entry if the server returned a different ID
						if (transformed.id !== parsedNewItem.data.id) {
							delete data.value[parsedNewItem.data.id];
						}

						data.value[transformed.id] = transformed;

						return transformed;
					}

					// Record could not be created on api, we have to remove it from a database
					delete data.value[parsedNewItem.data.id];

					let errorReason: string | null = 'Failed to create scene action.';

					if (error) {
						if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
					}

					throw new ScenesApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
				}
			}
		};

		const edit = async (payload: IScenesActionsEditActionPayload): Promise<ISceneAction> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new ScenesException('Action is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new ScenesException('Failed to get scene action data to update.');
			}

			const parsedPayload = ScenesActionsEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new ScenesValidationException('Failed to edit scene action.');
			}

			const parsedEditedItem = SceneActionSchema.safeParse({
				...data.value[payload.id],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedItem.success) {
				logger.error('Schema validation failed with:', parsedEditedItem.error);

				throw new ScenesValidationException('Failed to edit scene action.');
			}

			semaphore.value.updating.push(payload.id);

			data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

			if (parsedEditedItem.data.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

				return parsedEditedItem.data;
			} else {
				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.PATCH(`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions/{id}`, {
						params: {
							path: { sceneId: payload.sceneId, id: payload.id },
						},
						body: {
							data: transformSceneActionUpdateRequest(parsedEditedItem.data),
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformSceneActionResponse(responseData.data);

						data.value[transformed.id] = transformed;

						return transformed;
					}

					// Updating the record on api failed, we need to refresh the record
					await get({ id: payload.id, sceneId: payload.sceneId });

					let errorReason: string | null = 'Failed to update scene action.';

					if (error) {
						if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
					}

					throw new ScenesApiException(errorReason, response.status);
				} finally {
					semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
				}
			}
		};

		const save = async (payload: IScenesActionsSaveActionPayload): Promise<ISceneAction> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new ScenesException('Action is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new ScenesException('Failed to get scene action data to save.');
			}

			const parsedSaveItem = SceneActionSchema.safeParse(data.value[payload.id]);

			if (!parsedSaveItem.success) {
				logger.error('Schema validation failed with:', parsedSaveItem.error);

				throw new ScenesValidationException('Failed to save scene action.');
			}

			semaphore.value.updating.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions`, {
					params: {
						path: { sceneId: parsedSaveItem.data.scene },
					},
					body: {
						data: transformSceneActionCreateRequest(parsedSaveItem.data),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const transformed = transformSceneActionResponse(responseData.data);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to create scene action.';

				if (error) {
					if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
				}

				throw new ScenesApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: IScenesActionsRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new ScenesException('Action is already being removed.');
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
					const { error, response } = await backend.client.DELETE(
						`/${MODULES_PREFIX}/${SCENES_MODULE_PREFIX}/scenes/{sceneId}/actions/{id}`,
						{
							params: {
								path: { sceneId: payload.sceneId, id: payload.id },
							},
						}
					);

					if (response.status === 204) {
						return true;
					}

					// Deleting record on api failed, we need to refresh the record
					await get({ id: payload.id, sceneId: payload.sceneId });

					let errorReason: string | null = 'Remove action failed.';

					if (error) {
						if (typeof error === "object" && error !== null && "message" in error) { errorReason = String(error.message); }
					}

					throw new ScenesApiException(errorReason, response.status);
				} finally {
					semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
				}
			}

			return true;
		};

		return {
			semaphore,
			firstLoad,
			data,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findForScene,
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
		};
	}
);

export const registerScenesActionsStore = (pinia: Pinia): Store<string, IScenesActionsStoreState, object, IScenesActionsStoreActions> => {
	return useScenesActionsStore(pinia);
};

// Known fields that should not be sent as plugin-specific fields
const INTERNAL_ACTION_FIELDS = new Set(['id', 'draft', 'scene', 'createdAt', 'updatedAt']);

// Convert camelCase to snake_case
const camelToSnake = (str: string): string => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Helper functions for API request transformation
const transformSceneActionCreateRequest = (action: ISceneAction): ISceneActionCreateReq => {
	// Extract plugin-specific fields and convert to snake_case
	const extraFields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(action)) {
		if (!INTERNAL_ACTION_FIELDS.has(key) && !['type', 'configuration', 'order', 'enabled'].includes(key)) {
			extraFields[camelToSnake(key)] = value;
		}
	}

	const parsed = SceneActionCreateReqSchema.safeParse({
		id: action.id,
		type: action.type,
		configuration: action.configuration,
		order: action.order,
		enabled: action.enabled,
		...extraFields,
	});

	if (!parsed.success) {
		throw new ScenesValidationException('Failed to transform scene action create request.');
	}

	return parsed.data;
};

const transformSceneActionUpdateRequest = (action: ISceneAction): ISceneActionUpdateReq => {
	// Extract plugin-specific fields and convert to snake_case
	const extraFields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(action)) {
		if (!INTERNAL_ACTION_FIELDS.has(key) && !['type', 'configuration', 'order', 'enabled'].includes(key)) {
			extraFields[camelToSnake(key)] = value;
		}
	}

	const parsed = SceneActionUpdateReqSchema.safeParse({
		type: action.type,
		configuration: action.configuration,
		order: action.order,
		enabled: action.enabled,
		...extraFields,
	});

	if (!parsed.success) {
		throw new ScenesValidationException('Failed to transform scene action update request.');
	}

	return parsed.data;
};
