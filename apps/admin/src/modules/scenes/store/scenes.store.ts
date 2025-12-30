import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { useBackend, useLogger } from '../../../common';
import { SCENES_MODULE_PREFIX } from '../scenes.constants';
import { ScenesApiException, ScenesValidationException } from '../scenes.exceptions';

import {
	SceneCreateReqSchema,
	SceneSchema,
	SceneUpdateReqSchema,
	ScenesAddActionPayloadSchema,
	ScenesEditActionPayloadSchema,
} from './scenes.store.schemas';
import type {
	IScene,
	ISceneRes,
	ISceneExecutionResult,
	IScenesAddActionPayload,
	IScenesEditActionPayload,
	IScenesGetActionPayload,
	IScenesOnEventActionPayload,
	IScenesRemoveActionPayload,
	IScenesSaveActionPayload,
	IScenesSetActionPayload,
	IScenesStateSemaphore,
	IScenesStoreActions,
	IScenesStoreState,
	IScenesUnsetActionPayload,
	IScenesTriggerActionPayload,
} from './scenes.store.types';
import { transformSceneCreateRequest, transformSceneResponse, transformSceneUpdateRequest } from './scenes.transformers';

export type ScenesStoreSetup = IScenesStoreState & IScenesStoreActions;

const defaultSemaphore: IScenesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
	triggering: [],
};

export const useScenesStore = defineStore<'scenes_module-scenes', ScenesStoreSetup>('scenes_module-scenes', (): ScenesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<IScenesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<Map<IScene['id'], IScene>>(new Map());

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IScene['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IScene[] => Array.from(data.value.values());

	const findById = (id: IScene['id']): IScene | null => data.value.get(id) ?? null;

	const findBySpace = (spaceId: IScene['spaceId']): IScene[] => {
		return Array.from(data.value.values()).filter((scene) => scene.spaceId === spaceId);
	};

	const pendingGetPromises: Record<string, Promise<IScene>> = {};

	const pendingFetchPromises: Record<string, Promise<IScene[]>> = {};

	const onEvent = (payload: IScenesOnEventActionPayload): IScene => {
		return set({
			id: payload.id,
			data: transformSceneResponse(payload.data as unknown as ISceneRes, SceneSchema),
		});
	};

	const set = (payload: IScenesSetActionPayload): IScene => {
		const existingScene = data.value.get(payload.id);

		if (existingScene) {
			const parsed = SceneSchema.safeParse({ ...existingScene, ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new ScenesValidationException('Failed to insert scene.');
			}

			data.value.set(parsed.data.id, parsed.data);
			return parsed.data;
		}

		const parsed = SceneSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new ScenesValidationException('Failed to insert scene.');
		}

		data.value.set(parsed.data.id, parsed.data);
		return parsed.data;
	};

	const unset = (payload: IScenesUnsetActionPayload): void => {
		data.value.delete(payload.id);
	};

	const get = async (payload: IScenesGetActionPayload): Promise<IScene> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const getPromise = (async (): Promise<IScene> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new ScenesApiException('Already fetching scene.');
			}

			semaphore.value.fetching.item.push(payload.id);

			const existingRecord = data.value.get(payload.id);

			try {
				const response = await backend.client.GET(`/api/v1/${SCENES_MODULE_PREFIX}/scenes/{id}`, {
					params: { path: { id: payload.id } },
				});

				if (response.error || !response.data || !('data' in response.data)) {
					throw new ScenesApiException('Received unexpected response.');
				}

				const transformed = transformSceneResponse(response.data.data as ISceneRes, SceneSchema);

				return set({
					id: transformed.id,
					data: transformed,
				});
			} catch (e) {
				if (existingRecord) {
					return existingRecord;
				}

				throw new ScenesApiException('Failed to get scene.', null, e as Error);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((id) => id !== payload.id);
			}
		})();

		pendingGetPromises[payload.id] = getPromise;

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (): Promise<IScene[]> => {
		const cacheKey = 'all';

		if (cacheKey in pendingFetchPromises) {
			return pendingFetchPromises[cacheKey];
		}

		const fetchPromise = (async (): Promise<IScene[]> => {
			if (semaphore.value.fetching.items) {
				throw new ScenesApiException('Already fetching scenes.');
			}

			semaphore.value.fetching.items = true;

			firstLoad.value = false;

			try {
				const response = await backend.client.GET(`/api/v1/${SCENES_MODULE_PREFIX}/scenes`);

				if (response.error || !response.data || !('data' in response.data)) {
					throw new ScenesApiException('Received unexpected response.');
				}

				const scenes: IScene[] = [];

				for (const sceneData of response.data.data as ISceneRes[]) {
					const transformed = transformSceneResponse(sceneData, SceneSchema);

					set({
						id: transformed.id,
						data: transformed,
					});

					scenes.push(transformed);
				}

				firstLoad.value = true;

				return scenes;
			} catch (e) {
				throw new ScenesApiException('Failed to fetch scenes.', null, e as Error);
			} finally {
				semaphore.value.fetching.items = false;
			}
		})();

		pendingFetchPromises[cacheKey] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[cacheKey];
		}
	};

	const add = async (payload: IScenesAddActionPayload): Promise<IScene> => {
		const parsedPayload = ScenesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new ScenesValidationException('Failed to add scene.');
		}

		const { id, draft, data: sceneData } = parsedPayload.data;

		let scene = set({
			id,
			data: {
				...sceneData,
				id,
				draft,
				isTriggerable: true,
				isEditable: true,
				lastTriggeredAt: null,
				createdAt: new Date(),
				updatedAt: null,
			},
		});

		if (draft) {
			return scene;
		}

		semaphore.value.creating.push(id);

		try {
			const createData = transformSceneCreateRequest(sceneData, SceneCreateReqSchema);

			const response = await backend.client.POST(`/api/v1/${SCENES_MODULE_PREFIX}/scenes`, {
				body: { data: createData },
			});

			if (response.error || !response.data || !('data' in response.data)) {
				throw new ScenesApiException('Received unexpected response.');
			}

			const transformed = transformSceneResponse(response.data.data as ISceneRes, SceneSchema);

			scene = set({
				id: transformed.id,
				data: transformed,
			});

			return scene;
		} catch (e) {
			unset({ id });

			throw new ScenesApiException('Failed to create scene.', null, e as Error);
		} finally {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== id);
		}
	};

	const edit = async (payload: IScenesEditActionPayload): Promise<IScene> => {
		const parsedPayload = ScenesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new ScenesValidationException('Failed to edit scene.');
		}

		const { id, data: sceneData } = parsedPayload.data;

		const existingRecord = data.value.get(id);

		if (!existingRecord) {
			throw new ScenesApiException('Scene not found.');
		}

		let scene = set({
			id,
			data: {
				...sceneData,
			},
		});

		if (existingRecord.draft) {
			return scene;
		}

		semaphore.value.updating.push(id);

		try {
			const updateData = transformSceneUpdateRequest(sceneData, SceneUpdateReqSchema);

			const response = await backend.client.PATCH(`/api/v1/${SCENES_MODULE_PREFIX}/scenes/{id}`, {
				params: { path: { id } },
				body: { data: updateData },
			});

			if (response.error || !response.data || !('data' in response.data)) {
				throw new ScenesApiException('Received unexpected response.');
			}

			const transformed = transformSceneResponse(response.data.data as ISceneRes, SceneSchema);

			scene = set({
				id: transformed.id,
				data: transformed,
			});

			return scene;
		} catch (e) {
			set({
				id,
				data: existingRecord,
			});

			throw new ScenesApiException('Failed to update scene.', null, e as Error);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== id);
		}
	};

	const save = async (payload: IScenesSaveActionPayload): Promise<IScene> => {
		const existingRecord = data.value.get(payload.id);

		if (!existingRecord) {
			throw new ScenesApiException('Scene not found.');
		}

		if (!existingRecord.draft) {
			throw new ScenesApiException('Scene is not a draft.');
		}

		semaphore.value.creating.push(payload.id);

		try {
			const createData = transformSceneCreateRequest(existingRecord, SceneCreateReqSchema);

			const response = await backend.client.POST(`/api/v1/${SCENES_MODULE_PREFIX}/scenes`, {
				body: { data: createData },
			});

			if (response.error || !response.data || !('data' in response.data)) {
				throw new ScenesApiException('Received unexpected response.');
			}

			const transformed = transformSceneResponse(response.data.data as ISceneRes, SceneSchema);

			const scene = set({
				id: transformed.id,
				data: transformed,
			});

			return scene;
		} catch (e) {
			throw new ScenesApiException('Failed to save scene.', null, e as Error);
		} finally {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== payload.id);
		}
	};

	const remove = async (payload: IScenesRemoveActionPayload): Promise<void> => {
		const existingRecord = data.value.get(payload.id);

		if (!existingRecord) {
			return;
		}

		if (existingRecord.draft) {
			unset({ id: payload.id });
			return;
		}

		semaphore.value.deleting.push(payload.id);

		try {
			const response = await backend.client.DELETE(`/api/v1/${SCENES_MODULE_PREFIX}/scenes/{id}`, {
				params: { path: { id: payload.id } },
			});

			if (response.error) {
				throw new ScenesApiException('Received unexpected response.');
			}

			unset({ id: payload.id });
		} catch (e) {
			throw new ScenesApiException('Failed to remove scene.', null, e as Error);
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		}
	};

	const trigger = async (payload: IScenesTriggerActionPayload): Promise<ISceneExecutionResult> => {
		const existingRecord = data.value.get(payload.id);

		if (!existingRecord) {
			throw new ScenesApiException('Scene not found.');
		}

		if (!existingRecord.isTriggerable) {
			throw new ScenesApiException('Scene is not triggerable.');
		}

		semaphore.value.triggering.push(payload.id);

		try {
			const response = await backend.client.POST(`/api/v1/${SCENES_MODULE_PREFIX}/scenes/{id}/trigger`, {
				params: { path: { id: payload.id } },
				body: {
					data: {
						source: payload.source,
						context: payload.context,
					},
				},
			});

			if (response.error || !response.data || !('data' in response.data)) {
				throw new ScenesApiException('Received unexpected response.');
			}

			// Update lastTriggeredAt
			set({
				id: payload.id,
				data: {
					...existingRecord,
					lastTriggeredAt: new Date(),
				},
			});

			return response.data.data as ISceneExecutionResult;
		} catch (e) {
			throw new ScenesApiException('Failed to trigger scene.', null, e as Error);
		} finally {
			semaphore.value.triggering = semaphore.value.triggering.filter((item) => item !== payload.id);
		}
	};

	return {
		data,
		semaphore,
		firstLoad,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findById,
		findBySpace,
		onEvent,
		set,
		unset,
		get,
		fetch,
		add,
		edit,
		save,
		remove,
		trigger,
	};
});

export const registerScenesStore = (pinia: Pinia): Store<'scenes_module-scenes', ScenesStoreSetup> => {
	return useScenesStore(pinia);
};
