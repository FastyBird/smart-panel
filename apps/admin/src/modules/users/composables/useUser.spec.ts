import { type Ref, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IUser, IUsersStateSemaphore, UsersStore } from '../store/users.store.types';

import { useUser } from './useUser';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useUser', (): void => {
	let usersStoreMock: UsersStore;

	beforeEach((): void => {
		usersStoreMock = {
			get: vi.fn().mockResolvedValue(undefined),
			data: ref([]),
			semaphore: ref({
				fetching: {
					items: false,
					item: [],
				},
			}),
		} as UsersStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => usersStoreMock),
		});
	});

	it('should return null when id is null', (): void => {
		const { user } = useUser({ id: '' });

		expect(user.value).toBeNull();
	});

	it('should return user when found in store', (): void => {
		const userData = { id: 'user1', username: 'testuser' };

		(usersStoreMock.data as unknown as Ref<{ [key: IUser['id']]: IUser }>).value = { user1: userData as IUser };

		const { user } = useUser({ id: 'user1' });

		expect(user.value).toEqual(userData);
	});

	it('should call get() when user is missing', async (): Promise<void> => {
		const { fetchUser } = useUser({ id: 'user1' });

		await fetchUser();

		expect(usersStoreMock.get).toHaveBeenCalledWith({ id: 'user1' });
	});

	it('should not call get() when user is a draft', async (): Promise<void> => {
		(usersStoreMock.data as unknown as Ref<{ [key: IUser['id']]: IUser }>).value = { user1: { id: 'user1', draft: true } as IUser };

		const { fetchUser } = useUser({ id: 'user1' });

		await fetchUser();

		expect(usersStoreMock.get).not.toHaveBeenCalled();
	});

	it('should return isLoading as true when fetching or getting user', (): void => {
		(usersStoreMock.semaphore as unknown as Ref<IUsersStateSemaphore>).value = {
			fetching: {
				items: false,
				item: ['user1'],
			},
		} as unknown as IUsersStateSemaphore;

		const { isLoading } = useUser({ id: 'user1' });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading as false when user exists in store', (): void => {
		(usersStoreMock.data as unknown as Ref<{ [key: IUser['id']]: IUser }>).value = { user1: { id: 'user1' } as IUser };

		const { isLoading } = useUser({ id: 'user1' });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading as false when fetching() returns false', (): void => {
		(usersStoreMock.semaphore as unknown as Ref<IUsersStateSemaphore>).value = {
			fetching: {
				items: false,
				item: [],
			},
		} as unknown as IUsersStateSemaphore;

		const { isLoading } = useUser({ id: 'user1' });

		expect(isLoading.value).toBe(false);
	});
});
