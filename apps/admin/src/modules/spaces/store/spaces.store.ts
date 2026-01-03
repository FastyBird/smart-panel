import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';
import { v4 as uuid } from 'uuid';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';

import { SpacesApiException } from '../spaces.exceptions';

import type { ISpace, ISpaceCreateData, ISpaceEditData, ISpacesStateSemaphore, ISpacesStoreActions, ISpacesStoreState } from './spaces.store.types';
import { type ApiSpace, transformSpaceCreateRequest, transformSpaceEditRequest, transformSpaceResponse } from './spaces.transformers';

type SpacesStoreSetup = ISpacesStoreState & ISpacesStoreActions;

const defaultSemaphore: ISpacesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useSpacesStore = defineStore<'spaces_module-spaces', SpacesStoreSetup>('spaces_module-spaces', (): SpacesStoreSetup => {
	const backend = useBackend();

	const data = ref<{ [key: ISpace['id']]: ISpace }>({});
	const semaphore = ref({ ...defaultSemaphore });
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

			for (const spaceData of responseData.data ?? []) {
				const space = transformSpaceResponse(spaceData);
				data.value[space.id] = space;
				spaces.push(space);
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
		const space = transformSpaceResponse(payload.data as unknown as ApiSpace);
		data.value[space.id] = space;
	};

	return {
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
		set,
		unset,
		onEvent,
	};
});

export const registerSpacesStore = (pinia: Pinia): Store<string, ISpacesStoreState, object, ISpacesStoreActions> => {
	return useSpacesStore(pinia);
};
