import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';
import { v4 as uuid } from 'uuid';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';

import { SpacesApiException } from '../spaces.exceptions';

import { SpacesBulkResultSchema } from './spaces.store.schemas';
import type {
	ISpace,
	ISpaceCreateData,
	ISpaceEditData,
	ISpacesBulkRemoveActionPayload,
	ISpacesBulkResult,
	ISpacesStateSemaphore,
	ISpacesStoreActions,
	ISpacesStoreState,
} from './spaces.store.types';
import { type ApiSpace, transformSpaceCreateRequest, transformSpaceEditRequest, transformSpaceResponse } from './spaces.transformers';

type SpacesStoreSetup = ISpacesStoreState & ISpacesStoreActions;

/**
 * Built fresh per store rather than shared, so the arrays cannot outlive one
 * pinia instance.
 *
 * The previous `{ ...defaultSemaphore }` looked safe but was the one shape that
 * leaked: the spread copies the object, not the arrays, so `push` mutated the
 * module-level constant while the reassignment in each `finally` replaced the
 * property only on the copy. Anything pushed stayed on the constant, and the
 * next pinia - the next test - started with it.
 */
const createSemaphore = (): ISpacesStateSemaphore => ({
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
});

export const useSpacesStore = defineStore<'spaces_module-spaces', SpacesStoreSetup>('spaces_module-spaces', (): SpacesStoreSetup => {
	const backend = useBackend();

	const data = ref<{ [key: ISpace['id']]: ISpace }>({});
	const semaphore = ref<ISpacesStateSemaphore>(createSemaphore());
	const firstLoad = ref<boolean>(false);

	const firstLoadFinished = (): boolean => firstLoad.value;

	const fetching = (): boolean => semaphore.value.fetching.items || semaphore.value.fetching.item.length > 0;

	const findById = (id: ISpace['id']): ISpace | null => {
		return data.value[id] ?? null;
	};

	const findAll = (): ISpace[] => {
		return Object.values(data.value).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
	};

	const fetch = async (): Promise<ISpace[]> => {
		if (semaphore.value.fetching.items) {
			return findAll();
		}

		semaphore.value.fetching.items = true;

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces`);

			if (error || !responseData) {
				throw new SpacesApiException('Failed to fetch spaces');
			}

			const spaces: ISpace[] = [];
			const fetched = new Set<ISpace['id']>();

			for (const spaceData of responseData.data ?? []) {
				const space = transformSpaceResponse(spaceData);
				data.value[space.id] = space;
				fetched.add(space.id);
				spaces.push(space);
			}

			// This response is the whole collection, so anything missing from it is gone. Merging
			// alone would keep a deleted space on screen whenever its event was missed - which is
			// exactly the case after the browser has been asleep.
			for (const knownId of Object.keys(data.value)) {
				if (!fetched.has(knownId)) {
					delete data.value[knownId];
				}
			}

			firstLoad.value = true;

			return spaces;
		} finally {
			semaphore.value.fetching.items = false;
		}
	};

	const get = async (payload: { id: ISpace['id'] }): Promise<ISpace> => {
		if (semaphore.value.fetching.item.includes(payload.id)) {
			const existing = findById(payload.id);

			if (existing) {
				return existing;
			}

			throw new SpacesApiException('Space not found');
		}

		semaphore.value.fetching.item.push(payload.id);

		try {
			const { data: responseData, error } = await backend.client.GET(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`, {
				params: { path: { id: payload.id } },
			});

			if (error || !responseData) {
				throw new SpacesApiException('Space not found');
			}

			const space = transformSpaceResponse(responseData.data);
			data.value[space.id] = space;

			return space;
		} finally {
			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((id) => id !== payload.id);
		}
	};

	const add = async (payload: { id?: string; data: ISpaceCreateData }): Promise<ISpace> => {
		const id = payload.id ?? uuid().toString();

		semaphore.value.creating.push(id);

		try {
			const { data: responseData, error } = await backend.client.POST(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces`, {
				body: {
					data: transformSpaceCreateRequest(payload.data),
				},
			});

			if (error || !responseData) {
				throw new SpacesApiException('Failed to create space');
			}

			const space = transformSpaceResponse(responseData.data);
			data.value[space.id] = space;

			return space;
		} finally {
			semaphore.value.creating = semaphore.value.creating.filter((i) => i !== id);
		}
	};

	const edit = async (payload: { id: ISpace['id']; data: ISpaceEditData }): Promise<ISpace> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new SpacesApiException('Space is already being updated');
		}

		const existing = findById(payload.id);

		if (!existing) {
			throw new SpacesApiException('Space not found');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const { data: responseData, error } = await backend.client.PATCH(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`, {
				params: { path: { id: payload.id } },
				body: {
					data: transformSpaceEditRequest(payload.data),
				},
			});

			if (error || !responseData) {
				throw new SpacesApiException('Failed to update space');
			}

			const space = transformSpaceResponse(responseData.data);
			data.value[space.id] = space;

			return space;
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((id) => id !== payload.id);
		}
	};

	const save = async (payload: { id: ISpace['id'] }): Promise<ISpace> => {
		const existing = findById(payload.id);

		if (!existing) {
			throw new SpacesApiException('Space not found');
		}

		if (existing.draft) {
			const draftId = payload.id;

			const space = await add({
				id: draftId,
				data: {
					name: existing.name,
					description: existing.description,
					type: existing.type,
					category: existing.category,
					icon: existing.icon,
					displayOrder: existing.displayOrder,
				},
			});

			// Remove stale draft entry if server returned a different ID
			if (space.id !== draftId) {
				delete data.value[draftId];
			}

			return space;
		}

		return edit({
			id: payload.id,
			data: {
				name: existing.name,
				description: existing.description,
				type: existing.type,
				category: existing.category,
				icon: existing.icon,
				displayOrder: existing.displayOrder,
			},
		});
	};

	const remove = async (payload: { id: ISpace['id'] }): Promise<void> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new SpacesApiException('Space is already being deleted');
		}

		const existing = findById(payload.id);

		if (!existing) {
			throw new SpacesApiException('Space not found');
		}

		semaphore.value.deleting.push(payload.id);

		try {
			if (!existing.draft) {
				const { error } = await backend.client.DELETE(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`, {
					params: { path: { id: payload.id } },
				});

				if (error) {
					throw new SpacesApiException('Failed to delete space');
				}
			}

			delete data.value[payload.id];
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((id) => id !== payload.id);
		}
	};

	/**
	 * Removes a selection in one request.
	 *
	 * The per-space alternative was one request each, which the backend's shared rate limit rejects past
	 * thirty - so a large selection failed halfway through with no way to tell which half. The outcome is
	 * reported per space because the backend still refuses individual spaces for individual reasons.
	 */
	const bulkRemove = async (payload: ISpacesBulkRemoveActionPayload): Promise<ISpacesBulkResult> => {
		// Drafts were never sent to the backend, so they are dropped here and counted as done rather than
		// handed to an endpoint that would correctly report them as unknown.
		const drafts: string[] = [];
		const persisted: string[] = [];

		for (const id of payload.ids) {
			const existing = findById(id);

			if (!existing) {
				continue;
			}

			(existing.draft ? drafts : persisted).push(id);
		}

		for (const id of drafts) {
			unset({ id });
		}

		if (persisted.length === 0) {
			return { succeeded: drafts, failed: [] };
		}

		semaphore.value.deleting.push(...persisted);

		try {
			const { data: responseData, error } = await backend.client.POST(`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/bulk-remove`, {
				body: {
					data: { ids: persisted },
				},
			});

			if (error || !responseData) {
				throw new SpacesApiException('Received unexpected response');
			}

			const result = SpacesBulkResultSchema.parse(responseData.data);

			for (const id of result.succeeded) {
				unset({ id });
			}

			return { succeeded: [...drafts, ...result.succeeded], failed: result.failed };
		} catch (e) {
			throw new SpacesApiException('Failed to remove spaces', null, e as Error);
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((id) => !persisted.includes(id));
		}
	};

	const set = (payload: { id: ISpace['id']; data: Partial<ISpace> }): void => {
		const existing = data.value[payload.id];
		if (existing) {
			data.value[payload.id] = {
				...existing,
				...payload.data,
			};
		}
	};

	const unset = (payload: { id: ISpace['id'] }): void => {
		delete data.value[payload.id];
	};

	const onEvent = (payload: { id: ISpace['id']; data: Record<string, unknown> }): void => {
		const space = transformSpaceResponse(payload.data as ApiSpace);
		data.value[space.id] = space;
	};

	// Reconnect refresh contract: the store itself says whether it holds anything worth
	// re-reading, so the caller never has to guess from a flag it does not maintain.
	const isLoaded = (): boolean => firstLoadFinished() || findAll().length > 0;

	const refresh = (): Promise<unknown> => fetch();

	return {
		isLoaded,
		refresh,
		data,
		semaphore,
		firstLoad,
		firstLoadFinished,
		fetching,
		findById,
		findAll,
		fetch,
		get,
		add,
		edit,
		save,
		remove,
		bulkRemove,
		set,
		unset,
		onEvent,
	};
});

export const registerSpacesStore = (pinia: Pinia): Store<string, ISpacesStoreState, object, ISpacesStoreActions> => {
	return useSpacesStore(pinia);
};
