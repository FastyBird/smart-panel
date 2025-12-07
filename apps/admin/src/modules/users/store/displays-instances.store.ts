import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { useBackend, useLogger } from '../../../common';
import { UsersApiException, UsersException, UsersValidationException } from '../users.exceptions';

// Display instances have been consolidated into the DisplaysModule
const DISPLAYS_MODULE_PREFIX = 'displays-module';

import {
	DisplayInstanceSchema,
	DisplaysInstancesAddActionPayloadSchema,
	DisplaysInstancesEditActionPayloadSchema,
} from './displays-instances.store.schemas';
import type {
	DisplaysInstancesStoreSetup,
	IDisplayInstance,
	IDisplayInstanceRes,
	IDisplaysInstancesAddActionPayload,
	IDisplaysInstancesEditActionPayload,
	IDisplaysInstancesGetActionPayload,
	IDisplaysInstancesOnEventActionPayload,
	IDisplaysInstancesRemoveActionPayload,
	IDisplaysInstancesSaveActionPayload,
	IDisplaysInstancesSetActionPayload,
	IDisplaysInstancesStateSemaphore,
	IDisplaysInstancesStoreActions,
	IDisplaysInstancesStoreState,
	IDisplaysInstancesUnsetActionPayload,
} from './displays-instances.store.types';
import {
	transformDisplayInstanceCreateRequest,
	transformDisplayInstanceResponse,
	transformDisplayInstanceUpdateRequest,
} from './displays-instances.transformers';

const defaultSemaphore: IDisplaysInstancesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDisplaysInstances = defineStore<'users_module-displays-instances', DisplaysInstancesStoreSetup>(
	'users_module-displays-instances',
	(): DisplaysInstancesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IDisplaysInstancesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IDisplayInstance['id']]: IDisplayInstance }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (id: IDisplayInstance['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IDisplayInstance[] => Object.values(data.value);

		const findById = (id: IDisplayInstance['id']): IDisplayInstance | null => (id in data.value ? data.value[id] : null);

		const onEvent = (payload: IDisplaysInstancesOnEventActionPayload): IDisplayInstance => {
			return set({
				id: payload.id,
				data: transformDisplayInstanceResponse(payload.data as unknown as IDisplayInstanceRes),
			});
		};

		const set = (payload: IDisplaysInstancesSetActionPayload): IDisplayInstance => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = DisplayInstanceSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new UsersValidationException('Failed to insert display.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = DisplayInstanceSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new UsersValidationException('Failed to insert display.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IDisplaysInstancesUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			delete data.value[payload.id];

			return;
		};

		const get = async (payload: IDisplaysInstancesGetActionPayload): Promise<IDisplayInstance> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new UsersApiException('Already fetching display.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				if (typeof responseData !== 'undefined') {
					const display = transformDisplayInstanceResponse(responseData.data);

					data.value[display.id] = display;

					return display;
				}

				const errorReason: string | null = error ? 'Failed to fetch display.' : 'Failed to fetch display.';

				throw new UsersApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
			}
		};

		const fetch = async (): Promise<IDisplayInstance[]> => {
			if (semaphore.value.fetching.items) {
				throw new UsersApiException('Already fetching displays.');
			}

			semaphore.value.fetching.items = true;

			const { data: responseData, error, response } = await backend.client.GET(`/${DISPLAYS_MODULE_PREFIX}/displays`);

			semaphore.value.fetching.items = false;

			if (typeof responseData !== 'undefined') {
				data.value = Object.fromEntries(
					responseData.data.map((display) => {
						const transformedDisplay = transformDisplayInstanceResponse(display);

						return [transformedDisplay.id, transformedDisplay];
					})
				);

				firstLoad.value = true;

				return Object.values(data.value);
			}

			const errorReason: string | null = error ? 'Failed to fetch displays.' : 'Failed to fetch displays.';

			throw new UsersApiException(errorReason, response.status);
		};

		const add = async (payload: IDisplaysInstancesAddActionPayload): Promise<IDisplayInstance> => {
			const parsedPayload = DisplaysInstancesAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new UsersValidationException('Failed to add display.');
			}

			const parsedNewDisplay = DisplayInstanceSchema.safeParse({
				...parsedPayload.data.data,
				id: parsedPayload.data.id,
				draft: parsedPayload.data.draft,
				createdAt: new Date(),
			});

			if (!parsedNewDisplay.success) {
				logger.error('Schema validation failed with:', parsedNewDisplay.error);

				throw new UsersValidationException('Failed to add display.');
			}

			semaphore.value.creating.push(parsedNewDisplay.data.id);

			data.value[parsedNewDisplay.data.id] = parsedNewDisplay.data;

			if (parsedNewDisplay.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDisplay.data.id);

				return parsedNewDisplay.data;
			} else {
				try {
					// Note: DisplaysModule uses /register endpoint for creating new displays
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.POST(`/${DISPLAYS_MODULE_PREFIX}/register`, {
						params: {
							header: {
								'user-agent': 'FastyBird Smart Panel',
							},
						},
						body: {
							data: transformDisplayInstanceCreateRequest({ ...parsedNewDisplay.data, ...{ id: payload.id } }),
						},
					});

					if (typeof responseData !== 'undefined' && responseData.data.display.id === payload.id) {
						const display = transformDisplayInstanceResponse(responseData.data.display);

						data.value[display.id] = display;

						return display;
					}

					// Record could not be created on api, we have to remove it from a database
					delete data.value[parsedNewDisplay.data.id];

					const errorReason: string | null = error ? 'Failed to create display.' : 'Failed to create display.';

					throw new UsersApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDisplay.data.id);
				}
			}
		};

		const edit = async (payload: IDisplaysInstancesEditActionPayload): Promise<IDisplayInstance> => {
			const parsedPayload = DisplaysInstancesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new UsersValidationException('Failed to edit display.');
			}

			if (semaphore.value.updating.includes(payload.id)) {
				throw new UsersException('Display is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new UsersException('Failed to get display data to update.');
			}

			const parsedEditedDisplay = DisplayInstanceSchema.safeParse({
				...data.value[payload.id],
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedDisplay.success) {
				logger.error('Schema validation failed with:', parsedEditedDisplay.error);

				throw new UsersValidationException('Failed to edit display.');
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
					} = await backend.client.PATCH(`/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
						params: {
							path: {
								id: payload.id,
							},
						},
						body: {
							data: transformDisplayInstanceUpdateRequest(parsedEditedDisplay.data),
						},
					});

					if (typeof responseData !== 'undefined') {
						const display = transformDisplayInstanceResponse(responseData.data);

						data.value[display.id] = display;

						return display;
					}

					// Updating the record on api failed, we need to refresh the record
					await get({ id: payload.id });

					const errorReason: string | null = error ? 'Failed to update display.' : 'Failed to update display.';

					throw new UsersApiException(errorReason, response.status);
				} finally {
					semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
				}
			}
		};

		const save = async (payload: IDisplaysInstancesSaveActionPayload): Promise<IDisplayInstance> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new UsersException('Display is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new UsersException('Failed to get display data to save.');
			}

			const parsedSaveDisplay = DisplayInstanceSchema.safeParse(data.value[payload.id]);

			if (!parsedSaveDisplay.success) {
				logger.error('Schema validation failed with:', parsedSaveDisplay.error);

				throw new UsersValidationException('Failed to save display.');
			}

			semaphore.value.updating.push(payload.id);

			try {
				// Note: DisplaysModule uses /register endpoint for creating new displays
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DISPLAYS_MODULE_PREFIX}/register`, {
					params: {
						header: {
							'user-agent': 'FastyBird Smart Panel',
						},
					},
					body: {
						data: transformDisplayInstanceCreateRequest({ ...parsedSaveDisplay.data, ...{ id: payload.id } }),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.display.id === payload.id) {
					const display = transformDisplayInstanceResponse(responseData.data.display);

					data.value[display.id] = display;

					return display;
				}

				const errorReason: string | null = error ? 'Failed to create display.' : 'Failed to create display.';

				throw new UsersApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		};

		const remove = async (payload: IDisplaysInstancesRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new UsersException('Display is already being removed.');
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
					const { error, response } = await backend.client.DELETE(`/${DISPLAYS_MODULE_PREFIX}/displays/{id}`, {
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

					throw new UsersApiException(errorReason, response.status);
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

export const registerDisplaysInstancesStore = (pinia: Pinia): Store<string, IDisplaysInstancesStoreState, object, IDisplaysInstancesStoreActions> => {
	return useDisplaysInstances(pinia);
};
