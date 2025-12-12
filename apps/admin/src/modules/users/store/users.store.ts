import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	UsersModuleGetUserOperation,
	UsersModuleGetUsersOperation,
	UsersModuleCreateUserOperation,
	UsersModuleUpdateUserOperation,
	UsersModuleDeleteUserOperation,
} from '../../../openapi.constants';
import { USERS_MODULE_PREFIX } from '../users.constants';
import { UsersApiException, UsersException, UsersValidationException } from '../users.exceptions';

import { UserSchema, UsersAddActionPayloadSchema, UsersEditActionPayloadSchema } from './users.store.schemas';
import type {
	IUser,
	IUserRes,
	IUsersAddActionPayload,
	IUsersEditActionPayload,
	IUsersGetActionPayload,
	IUsersOnEventActionPayload,
	IUsersRemoveActionPayload,
	IUsersSaveActionPayload,
	IUsersSetActionPayload,
	IUsersStateSemaphore,
	IUsersStoreActions,
	IUsersStoreState,
	IUsersUnsetActionPayload,
	UsersStoreSetup,
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

export const useUsers = defineStore<'users_module-users', UsersStoreSetup>('users_module-users', (): UsersStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<IUsersStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IUser['id']]: IUser }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IUser['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IUser[] => Object.values(data.value);

	const findById = (id: IUser['id']): IUser | null => (id in data.value ? data.value[id] : null);

	const onEvent = (payload: IUsersOnEventActionPayload): IUser => {
		return set({
			id: payload.id,
			data: transformUserResponse(payload.data as unknown as IUserRes),
		});
	};

	const set = (payload: IUsersSetActionPayload): IUser => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsed = UserSchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new UsersValidationException('Failed to insert user.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = UserSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new UsersValidationException('Failed to insert user.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: IUsersUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IUsersGetActionPayload): Promise<IUser> => {
		if (semaphore.value.fetching.item.includes(payload.id)) {
			throw new UsersApiException('Already fetching user.');
		}

		semaphore.value.fetching.item.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			if (typeof responseData !== 'undefined') {
				const user = transformUserResponse(responseData.data);

				data.value[user.id] = user;

				return user;
			}

			let errorReason: string | null = 'Failed to fetch user.';

			if (error) {
				errorReason = getErrorReason<UsersModuleGetUserOperation>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		} finally {
			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
		}
	};

	const fetch = async (): Promise<IUser[]> => {
		if (semaphore.value.fetching.items) {
			throw new UsersApiException('Already fetching users.');
		}

		semaphore.value.fetching.items = true;

		try {
			const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users`);

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
				errorReason = getErrorReason<UsersModuleGetUsersOperation>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		} finally {
			semaphore.value.fetching.items = false;
		}
	};

	const add = async (payload: IUsersAddActionPayload): Promise<IUser> => {
		const parsedPayload = UsersAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new UsersValidationException('Failed to add user.');
		}

		const parsedNewUser = UserSchema.safeParse({
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewUser.success) {
			logger.error('Schema validation failed with:', parsedNewUser.error);

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

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users`, {
					body: {
						data: transformUserCreateRequest({ ...parsedNewUser.data, ...{ id: payload.id, password } }),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const user = transformUserResponse(responseData.data);

					data.value[user.id] = user;

					return user;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewUser.data.id];

				let errorReason: string | null = 'Failed to create user.';

				if (error) {
					errorReason = getErrorReason<UsersModuleCreateUserOperation>(error, errorReason);
				}

				throw new UsersApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewUser.data.id);
			}
		}
	};

	const edit = async (payload: IUsersEditActionPayload): Promise<IUser> => {
		const parsedPayload = UsersEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

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
			logger.error('Schema validation failed with:', parsedEditedUser.error);

			throw new UsersValidationException('Failed to edit user.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedUser.data.id] = parsedEditedUser.data;

		if (parsedEditedUser.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedUser.data.id);

			return parsedEditedUser.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
					body: {
						data: transformUserUpdateRequest(parsedEditedUser.data),
					},
				});

				if (typeof responseData !== 'undefined') {
					const user = transformUserResponse(responseData.data);

					data.value[user.id] = user;

					return user;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Failed to update user.';

				if (error) {
					errorReason = getErrorReason<UsersModuleUpdateUserOperation>(error, errorReason);
				}

				throw new UsersApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
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
			logger.error('Schema validation failed with:', parsedSaveUser.error);

			throw new UsersValidationException('Failed to save user.');
		}

		semaphore.value.updating.push(payload.id);

		const password = parsedSaveUser.data.password;

		if (typeof password === 'undefined') {
			throw new UsersValidationException('Failed to add user.');
		}

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users`, {
				body: {
					data: transformUserCreateRequest({ ...parsedSaveUser.data, ...{ id: payload.id, password } }),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const user = transformUserResponse(responseData.data);

				data.value[user.id] = user;

				return user;
			}

			let errorReason: string | null = 'Failed to create user.';

			if (error) {
				errorReason = getErrorReason<UsersModuleCreateUserOperation>(error, errorReason);
			}

			throw new UsersApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
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
			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${USERS_MODULE_PREFIX}/users/{id}`, {
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

				let errorReason: string | null = 'Remove account failed.';

				if (error) {
					errorReason = getErrorReason<UsersModuleDeleteUserOperation>(error, errorReason);
				}

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
});

export const registerUsersStore = (pinia: Pinia): Store<string, IUsersStoreState, object, IUsersStoreActions> => {
	return useUsers(pinia);
};
