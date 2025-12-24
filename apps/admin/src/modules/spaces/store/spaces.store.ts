import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';
import { v4 as uuid } from 'uuid';

import { useBackend } from '../../../common';

import { SpacesApiException } from '../spaces.exceptions';

import type { ISpace, ISpaceCreateData, ISpaceEditData, ISpacesFetching, ISpacesStore, ISpacesStoreActions, ISpacesStoreState } from './spaces.store.types';
import { transformSpaceCreateRequest, transformSpaceEditRequest, transformSpaceResponse } from './spaces.transformers';

const defaultSemaphore = {
	fetching: {
		items: false,
		item: [],
	} as ISpacesFetching,
	creating: [],
	updating: [],
	deleting: [],
};

export const useSpacesStore = defineStore<'spaces_module-spaces', ISpacesStore>('spaces_module-spaces', (): ISpacesStore => {
	const backend = useBackend();

	const data = ref<{ [key: ISpace['id']]: ISpace }>({});
	const semaphore = ref({ ...defaultSemaphore });
	const firstLoad = ref<boolean>(false);

	const firstLoadFinished = (): boolean => firstLoad.value;

	const fetching = (): boolean => semaphore.value.fetching.items || semaphore.value.fetching.item.length > 0;

	const findById = (id: ISpace['id']): ISpace | null => {
		return id in data.value ? data.value[id] : null;
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
			const response = await backend.client.GET('/api/v1/modules/spaces/spaces');

			if (response.error || !response.data) {
				throw new SpacesApiException('Failed to fetch spaces');
			}

			const spaces: ISpace[] = [];

			for (const spaceData of response.data.data ?? []) {
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
			const response = await backend.client.GET('/api/v1/modules/spaces/spaces/{id}', {
				params: { path: { id: payload.id } },
			});

			if (response.error || !response.data) {
				throw new SpacesApiException('Space not found');
			}

			const space = transformSpaceResponse(response.data.data);
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
			const response = await backend.client.POST('/api/v1/modules/spaces/spaces', {
				body: {
					data: transformSpaceCreateRequest(payload.data),
				},
			});

			if (response.error || !response.data) {
				throw new SpacesApiException('Failed to create space');
			}

			const space = transformSpaceResponse(response.data.data);
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
			const response = await backend.client.PATCH('/api/v1/modules/spaces/spaces/{id}', {
				params: { path: { id: payload.id } },
				body: {
					data: transformSpaceEditRequest(payload.data),
				},
			});

			if (response.error || !response.data) {
				throw new SpacesApiException('Failed to update space');
			}

			const space = transformSpaceResponse(response.data.data);
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
			return add({
				id: payload.id,
				data: {
					name: existing.name,
					description: existing.description,
					type: existing.type,
					icon: existing.icon,
					displayOrder: existing.displayOrder,
				},
			});
		}

		return edit({
			id: payload.id,
			data: {
				name: existing.name,
				description: existing.description,
				type: existing.type,
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
				const response = await backend.client.DELETE('/api/v1/modules/spaces/spaces/{id}', {
					params: { path: { id: payload.id } },
				});

				if (response.error) {
					throw new SpacesApiException('Failed to delete space');
				}
			}

			delete data.value[payload.id];
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((id) => id !== payload.id);
		}
	};

	const set = (payload: { id: ISpace['id']; data: Partial<ISpace> }): void => {
		if (payload.id in data.value) {
			data.value[payload.id] = {
				...data.value[payload.id],
				...payload.data,
			};
		}
	};

	const unset = (payload: { id: ISpace['id'] }): void => {
		delete data.value[payload.id];
	};

	const onEvent = (payload: { id: ISpace['id']; data: Record<string, unknown> }): void => {
		const space = transformSpaceResponse(payload.data as any);
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
