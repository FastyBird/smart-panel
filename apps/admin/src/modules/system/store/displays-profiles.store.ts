import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';
import { SystemApiException, SystemException, SystemValidationException } from '../system.exceptions';

import {
	DisplayProfileSchema,
	DisplaysProfilesAddActionPayloadSchema,
	DisplaysProfilesEditActionPayloadSchema,
} from './displays-profiles.store.schemas';
import type {
	DisplaysProfilesStoreSetup,
	IDisplayProfile,
	IDisplayProfileRes,
	IDisplaysProfilesAddActionPayload,
	IDisplaysProfilesEditActionPayload,
	IDisplaysProfilesGetActionPayload,
	IDisplaysProfilesOnEventActionPayload,
	IDisplaysProfilesRemoveActionPayload,
	IDisplaysProfilesSaveActionPayload,
	IDisplaysProfilesSetActionPayload,
	IDisplaysProfilesStateSemaphore,
	IDisplaysProfilesStoreActions,
	IDisplaysProfilesStoreState,
	IDisplaysProfilesUnsetActionPayload,
} from './displays-profiles.store.types';
import {
	transformDisplayProfileCreateRequest,
	transformDisplayProfileResponse,
	transformDisplayProfileUpdateRequest,
} from './displays-profiles.transformers';

const defaultSemaphore: IDisplaysProfilesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDisplaysProfiles = defineStore<'system_module-displays-profiles', DisplaysProfilesStoreSetup>(
	'system_module-displays-profiles',
	(): DisplaysProfilesStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IDisplaysProfilesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<{ [key: IDisplayProfile['id']]: IDisplayProfile }>({});

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (id: IDisplayProfile['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IDisplayProfile[] => Object.values(data.value);

		const findById = (id: IDisplayProfile['id']): IDisplayProfile | null => (id in data.value ? data.value[id] : null);

		const onEvent = (payload: IDisplaysProfilesOnEventActionPayload): IDisplayProfile => {
			return set({
				id: payload.id,
				data: transformDisplayProfileResponse(payload.data as unknown as IDisplayProfileRes),
			});
		};

		const set = (payload: IDisplaysProfilesSetActionPayload): IDisplayProfile => {
			if (payload.id && data.value && payload.id in data.value) {
				const parsed = DisplayProfileSchema.safeParse({ ...data.value[payload.id], ...payload.data });

				if (!parsed.success) {
					console.error('Schema validation failed with:', parsed.error);

					throw new SystemValidationException('Failed to insert display.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = DisplayProfileSchema.safeParse({ ...payload.data, id: payload.id });

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

				throw new SystemValidationException('Failed to insert display.');
			}

			data.value = data.value ?? {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IDisplaysProfilesUnsetActionPayload): void => {
			if (!data.value) {
				return;
			}

			delete data.value[payload.id];

			return;
		};

		const get = async (payload: IDisplaysProfilesGetActionPayload): Promise<IDisplayProfile> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new SystemApiException('Already fetching display.');
			}

			semaphore.value.fetching.item.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/displays-profiles/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const display = transformDisplayProfileResponse(responseData.data);

				data.value[display.id] = display;

				return display;
			}

			let errorReason: string | null = 'Failed to fetch display.';

			if (error) {
				errorReason = getErrorReason<operations['get-system-module-display-profile']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
		};

		const fetch = async (): Promise<IDisplayProfile[]> => {
			if (semaphore.value.fetching.items) {
				throw new SystemApiException('Already fetching displays.');
			}

			semaphore.value.fetching.items = true;

			const { data: responseData, error, response } = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/displays-profiles`);

			semaphore.value.fetching.items = false;

			if (typeof responseData !== 'undefined') {
				data.value = Object.fromEntries(
					responseData.data.map((display) => {
						const transformedDisplay = transformDisplayProfileResponse(display);

						return [transformedDisplay.id, transformedDisplay];
					})
				);

				firstLoad.value = true;

				return Object.values(data.value);
			}

			let errorReason: string | null = 'Failed to fetch displays.';

			if (error) {
				errorReason = getErrorReason<operations['get-system-module-displays-profiles']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
		};

		const add = async (payload: IDisplaysProfilesAddActionPayload): Promise<IDisplayProfile> => {
			const parsedPayload = DisplaysProfilesAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new SystemValidationException('Failed to add display.');
			}

			const parsedNewDisplay = DisplayProfileSchema.safeParse({
				...parsedPayload.data.data,
				id: parsedPayload.data.id,
				createdAt: new Date(),
			});

			if (!parsedNewDisplay.success) {
				console.error('Schema validation failed with:', parsedNewDisplay.error);

				throw new SystemValidationException('Failed to add display.');
			}

			semaphore.value.creating.push(parsedNewDisplay.data.id);

			data.value[parsedNewDisplay.data.id] = parsedNewDisplay.data;

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${SYSTEM_MODULE_PREFIX}/displays-profiles`, {
				body: {
					data: transformDisplayProfileCreateRequest({ ...parsedNewDisplay.data, ...{ id: payload.id } }),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDisplay.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const display = transformDisplayProfileResponse(responseData.data);

				data.value[display.id] = display;

				return display;
			}

			// Record could not be created on api, we have to remove it from a database
			delete data.value[parsedNewDisplay.data.id];

			let errorReason: string | null = 'Failed to create display.';

			if (error) {
				errorReason = getErrorReason<operations['create-system-module-display-profile']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
		};

		const edit = async (payload: IDisplaysProfilesEditActionPayload): Promise<IDisplayProfile> => {
			const parsedPayload = DisplaysProfilesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new SystemValidationException('Failed to edit display.');
			}

			if (semaphore.value.updating.includes(payload.id)) {
				throw new SystemException('Display is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new SystemException('Failed to get display data to update.');
			}

			const parsedEditedDisplay = DisplayProfileSchema.safeParse({
				...data.value[payload.id],
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedDisplay.success) {
				console.error('Schema validation failed with:', parsedEditedDisplay.error);

				throw new SystemValidationException('Failed to edit display.');
			}

			semaphore.value.updating.push(payload.id);

			data.value[parsedEditedDisplay.data.id] = parsedEditedDisplay.data;

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.PATCH(`/${SYSTEM_MODULE_PREFIX}/displays-profiles/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
				body: {
					data: transformDisplayProfileUpdateRequest(parsedEditedDisplay.data),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const display = transformDisplayProfileResponse(responseData.data);

				data.value[display.id] = display;

				return display;
			}

			// Updating the record on api failed, we need to refresh the record
			await get({ id: payload.id });

			let errorReason: string | null = 'Failed to update display.';

			if (error) {
				errorReason = getErrorReason<operations['update-system-module-display-profile']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
		};

		const save = async (payload: IDisplaysProfilesSaveActionPayload): Promise<IDisplayProfile> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new SystemException('Display is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new SystemException('Failed to get display data to save.');
			}

			const parsedSaveDisplay = DisplayProfileSchema.safeParse(data.value[payload.id]);

			if (!parsedSaveDisplay.success) {
				console.error('Schema validation failed with:', parsedSaveDisplay.error);

				throw new SystemValidationException('Failed to save display.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${SYSTEM_MODULE_PREFIX}/displays-profiles`, {
				body: {
					data: transformDisplayProfileCreateRequest({ ...parsedSaveDisplay.data, ...{ id: payload.id } }),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const display = transformDisplayProfileResponse(responseData.data);

				data.value[display.id] = display;

				return display;
			}

			let errorReason: string | null = 'Failed to create display.';

			if (error) {
				errorReason = getErrorReason<operations['create-system-module-display-profile']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
		};

		const remove = async (payload: IDisplaysProfilesRemoveActionPayload): Promise<boolean> => {
			if (semaphore.value.deleting.includes(payload.id)) {
				throw new SystemException('Display is already being removed.');
			}

			if (!Object.keys(data.value).includes(payload.id)) {
				return true;
			}

			semaphore.value.deleting.push(payload.id);

			delete data.value[payload.id];

			const { error, response } = await backend.client.DELETE(`/${SYSTEM_MODULE_PREFIX}/displays-profiles/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
			});

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				return true;
			}

			// Deleting record on api failed, we need to refresh the record
			await get({ id: payload.id });

			let errorReason: string | null = 'Remove account failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-system-module-display-profile']>(error, errorReason);
			}

			throw new SystemApiException(errorReason, response.status);
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

export const registerDisplaysProfilesStore = (pinia: Pinia): Store<string, IDisplaysProfilesStoreState, object, IDisplaysProfilesStoreActions> => {
	return useDisplaysProfiles(pinia);
};
