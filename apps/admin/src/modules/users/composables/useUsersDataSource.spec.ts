import { type Ref, nextTick, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi';
import type { IUsersStateSemaphore, UsersStore } from '../store/users.store.types';

import { useUsersDataSource } from './useUsersDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(() => ({
			getStore: vi.fn(() => ({
				findAll: vi.fn(),
				fetch: vi.fn(),
				semaphore: ref({
					fetching: {
						items: false,
					},
				}),
				firstLoad: ref(false),
			})),
		})),
	};
});

describe('useUsers', (): void => {
	let usersStoreMock: UsersStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		usersStoreMock = {
			findAll: vi.fn(),
			fetch: vi.fn(),
			semaphore: ref({
				fetching: {
					items: false,
				},
			}),
			firstLoad: ref(false),
		} as UsersStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => usersStoreMock),
		});

		vi.clearAllMocks();
	});

	it('should fetch users', async (): Promise<void> => {
		(usersStoreMock.fetch as Mock).mockResolvedValue([]);

		const usersHandler = useUsersDataSource();

		await usersHandler.fetchUsers();

		expect(usersStoreMock.fetch).toHaveBeenCalled();
	});

	it('should return sorted users', async (): Promise<void> => {
		(usersStoreMock.findAll as Mock).mockReturnValue([
			{ id: '1', username: 'zack', firstName: 'Zack', lastName: 'Doe', email: 'zack@example.com', role: UsersModuleUserRole.user, draft: false },
			{ id: '2', username: 'anna', firstName: 'Anna', lastName: 'Smith', email: 'anna@example.com', role: UsersModuleUserRole.admin, draft: false },
		]);

		const usersHandler = useUsersDataSource();

		usersHandler.sortBy.value = 'username';
		usersHandler.sortDir.value = 'ascending';

		expect(usersHandler.users.value.map((u) => u.username)).toEqual(['anna', 'zack']);

		usersHandler.sortDir.value = 'descending';

		expect(usersHandler.users.value.map((u) => u.username)).toEqual(['zack', 'anna']);
	});

	it('should filter users by search query', async (): Promise<void> => {
		(usersStoreMock.findAll as Mock).mockReturnValue([
			{ id: '1', username: 'john', firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: UsersModuleUserRole.user, draft: false },
			{ id: '2', username: 'jane', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: UsersModuleUserRole.admin, draft: false },
		]);

		const usersHandler = useUsersDataSource();

		usersHandler.filters.value.search = 'john';

		expect(usersHandler.users.value.length).toBe(1);
		expect(usersHandler.users.value[0].username).toBe('john');
	});

	it('should filter users by role', async (): Promise<void> => {
		(usersStoreMock.findAll as Mock).mockReturnValue([
			{ id: '1', username: 'john', firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: UsersModuleUserRole.user, draft: false },
			{ id: '2', username: 'admin', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', role: UsersModuleUserRole.admin, draft: false },
		]);

		const usersHandler = useUsersDataSource();

		usersHandler.filters.value.roles = [UsersModuleUserRole.admin];

		expect(usersHandler.users.value.length).toBe(1);
		expect(usersHandler.users.value[0].role).toBe(UsersModuleUserRole.admin);
	});

	it('should paginate users correctly', async (): Promise<void> => {
		(usersStoreMock.findAll as Mock).mockReturnValue(
			Array.from({ length: 30 }, (_, i) => ({ id: `${i + 1}`, username: `user${i + 1}`, draft: false }))
		);

		const usersHandler = useUsersDataSource();

		usersHandler.paginateSize.value = 10;
		usersHandler.paginatePage.value = 1;

		expect(usersHandler.usersPaginated.value.length).toBe(10);
		expect(usersHandler.usersPaginated.value[0].username).toBe('user1');

		usersHandler.paginatePage.value = 2;

		expect(usersHandler.usersPaginated.value[0].username).toBe('user11');
	});

	it('should handle loading states correctly', async (): Promise<void> => {
		const usersHandler = useUsersDataSource();

		(usersStoreMock.semaphore as unknown as Ref<IUsersStateSemaphore>).value = {
			fetching: {
				items: true,
			},
		} as unknown as IUsersStateSemaphore;
		(usersStoreMock.firstLoad as unknown as Ref<boolean>).value = false;

		await nextTick();

		expect(usersHandler.areLoading.value).toBe(true);

		vi.clearAllMocks();

		(usersStoreMock.semaphore as unknown as Ref<IUsersStateSemaphore>).value = {
			fetching: {
				items: false,
			},
		} as unknown as IUsersStateSemaphore;
		(usersStoreMock.firstLoad as unknown as Ref<boolean>).value = true;

		await nextTick();

		expect(usersHandler.areLoading.value).toBe(false);
	});

	it('should reset filters', async (): Promise<void> => {
		const usersHandler = useUsersDataSource();

		usersHandler.filters.value.search = 'test';
		usersHandler.filters.value.roles = [UsersModuleUserRole.admin];

		usersHandler.resetFilter();

		expect(usersHandler.filters.value.search).toBeUndefined();
		expect(usersHandler.filters.value.roles).toEqual([]);
	});
});
