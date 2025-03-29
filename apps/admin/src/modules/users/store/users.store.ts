import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { USERS_MODULE_PREFIX } from '../users.constants';
import { UsersApiException, UsersException, UsersValidationException } from '../users.exceptions';

import {
	type IUser,
	type IUsersAddActionPayload,
	type IUsersEditActionPayload,
	type IUsersGetActionPayload,
	type IUsersRemoveActionPayload,
	type IUsersSaveActionPayload,
	type IUsersStateSemaphore,
	type IUsersStoreActions,
	type IUsersStoreState,
	UserSchema,
	UsersAddActionPayloadSchema,
	UsersEditActionPayloadSchema,
	type UsersStoreSetup,
} from './users.store.types';
import { transformUserCreateRequest, transformUserResponse, transformUserUpdateRequest } from './users.transformers';

const defaultSemaphore: IUsersStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useUsers = defineStore<'users-module_users', UsersStoreSetup>('users-module_users', (): UsersStoreSetup => {
	const backend = useBackend();

	const semaphore = ref<IUsersStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IUser['id']]: IUser }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IUser['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IUser[] => Object.values(data.value);

	const findById = (id: IUser['id']): IUser | null => (id in data.value ? data.value[id] : null);

	const get = async (payload: IUsersGetActionPayload): Promise<IUser> => {
		if (semaphore.value.fetching.item.includes(payload.id)) {
			throw new UsersApiException('Already fetching user.');
		}

		semaphore.value.fetching.item.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.GET(`/${USERS_MODULE_PREFIX}/users/{id}`, {
			params: {
				path: { id: payload.id },
			},
		});

		semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined') {
			const user = transformUserResponse(responseData.data);

			data.value[user.id] = user;

			return user;
		}

		let errorReason: string | null = 'Failed to fetch user.';

		if (error) {
			errorReason = getErrorReason<operations['get-users-module-user']>(error, errorReason);
		}

		throw new UsersApiException(errorReason, response.status);
	};

	const fetch = async (): Promise<IUser[]> => {
		if (semaphore.value.fetching.items) {
			throw new UsersApiException('Already fetching users.');
		}

		semaphore.value.fetching.items = true;

		const { data: responseData, error, response } = await backend.client.GET(`/${USERS_MODULE_PREFIX}/users`);

		semaphore.value.fetching.items = false;

		if (typeof responseData !== 'undefined') {
			data.value = Object.fromEntries(
				responseData.data.map((user) => {
					const transformedUser = transformUserResponse(user);

					return [transformedUser.id, transformedUser];
				})
			);

			firstLoad.value = true;

			return Object.values(data.value);
		}

		let errorReason: string | null = 'Failed to fetch users.';

		if (error) {
			errorReason = getErrorReason<operations['get-users-module-users']>(error, errorReason);
		}

		throw new UsersApiException(errorReason, response.status);
	};

	const add = async (payload: IUsersAddActionPayload): Promise<IUser> => {
		const parsedPayload = UsersAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			throw new UsersValidationException('Failed to add user.');
		}

		const parsedNewUser = UserSchema.safeParse({
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewUser.success) {
			throw new UsersValidationException('Failed to add user.');
		}

		semaphore.value.creating.push(parsedNewUser.data.id);

		data.value[parsedNewUser.data.id] = parsedNewUser.data;

		if (parsedNewUser.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewUser.data.id);

			return parsedNewUser.data;
		} else {
			const password = parsedNewUser.data.password;

			if (typeof password === 'undefined') {
				throw new UsersValidationException('Failed to add user.');
			}

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${USERS_MODULE_PREFIX}/users`, {
				body: {
					data: transformUserCreateRequest({ ...parsedNewUser.data, ...{ id: payload.id, password } }),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewUser.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const user = transformUserResponse(responseData.data);

				data.value[user.id] = user;

				return user;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewUser.data.id];

			let errorReason: string | null = 'Failed to create user.';

			if (error) {
				errorReason = getErrorReason<operations['create-users-module-user']>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: IUsersEditActionPayload): Promise<IUser> => {
		const parsedPayload = UsersEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			throw new UsersValidationException('Failed to edit user.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new UsersException('User is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new UsersException('Failed to get user data to update.');
		}

		const parsedEditedUser = UserSchema.safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedUser.success) {
			throw new UsersValidationException('Failed to edit user.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedUser.data.id] = parsedEditedUser.data;

		if (parsedEditedUser.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedUser.data.id);

			return parsedEditedUser.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.PATCH(`/${USERS_MODULE_PREFIX}/users/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
				body: {
					data: transformUserUpdateRequest(parsedEditedUser.data),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const user = transformUserResponse(responseData.data);

				data.value[user.id] = user;

				return user;
			}

			// Updating record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Failed to update user.';

			if (error) {
				errorReason = getErrorReason<operations['update-users-module-user']>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		}
	};

	const save = async (payload: IUsersSaveActionPayload): Promise<IUser> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new UsersException('User is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new UsersException('Failed to get user data to save.');
		}

		const parsedSaveUser = UserSchema.safeParse(data.value[payload.id]);

		if (!parsedSaveUser.success) {
			throw new UsersValidationException('Failed to save user.');
		}

		semaphore.value.updating.push(payload.id);

		const password = parsedSaveUser.data.password;

		if (typeof password === 'undefined') {
			throw new UsersValidationException('Failed to add user.');
		}

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${USERS_MODULE_PREFIX}/users`, {
			body: {
				data: transformUserCreateRequest({ ...parsedSaveUser.data, ...{ id: payload.id, password } }),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const user = transformUserResponse(responseData.data);

			data.value[user.id] = user;

			return user;
		}

		let errorReason: string | null = 'Failed to create user.';

		if (error) {
			errorReason = getErrorReason<operations['create-users-module-user']>(error, errorReason);
		}

		throw new UsersApiException(errorReason, response.status);
	};

	const remove = async (payload: IUsersRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new UsersException('User is already being removed.');
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
			const { error, response } = await backend.client.DELETE(`/${USERS_MODULE_PREFIX}/users/{id}`, {
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

			// Deleting record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Remove account failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-users-module-user']>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		}

		return true;
	};

	return { semaphore, firstLoad, data, firstLoadFinished, getting, fetching, findAll, findById, get, fetch, add, edit, save, remove };
});

export const registerUsersStore = (pinia: Pinia): Store<string, IUsersStoreState, object, IUsersStoreActions> => {
	return useUsers(pinia);
};
