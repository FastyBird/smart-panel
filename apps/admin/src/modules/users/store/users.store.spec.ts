import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { type IUseBackend, useBackend } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { UsersApiException } from '../users.exceptions';

import { useUsers } from './users.store';

const userId = uuid();

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(),
	};
});

describe('Users Store', (): void => {
	let usersStore: ReturnType<typeof useUsers>;
	let backendMock: IUseBackend;

	beforeEach((): void => {
		setActivePinia(createPinia());

		backendMock = useBackend();

		usersStore = useUsers();

		vi.clearAllMocks();
	});

	it('should fetch users successfully', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: userId,
						username: 'john_doe',
						email: 'john@example.com',
						first_name: 'John',
						last_name: 'Doe',
						role: UsersModuleUserRole.user,
						created_at: '2024-03-01T12:00:00Z',
						updated_at: '2024-03-02T12:00:00Z',
					},
				],
			},
		});

		await usersStore.fetch();

		expect(usersStore.findAll()).toHaveLength(1);
		expect(usersStore.findById(userId)?.username).toBe('john_doe');
		expect(usersStore.firstLoadFinished()).toBe(true);
	});

	it('should throw error when fetching users fails', async (): Promise<void> => {
		(backendMock.client.GET as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(usersStore.fetch()).rejects.toThrow(UsersApiException);
	});

	it('should add a user successfully', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({
			data: {
				data: {
					id: userId,
					username: 'jane_doe',
					email: 'jane@example.com',
					first_name: 'Jane',
					last_name: 'Doe',
					role: UsersModuleUserRole.admin,
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const user = await usersStore.add({
			id: userId,
			draft: false,
			data: {
				username: 'jane_doe',
				password: 'securePass123',
				email: 'jane@example.com',
				firstName: 'Jane',
				lastName: 'Doe',
				role: UsersModuleUserRole.admin,
			},
		});

		expect(user.id).toBe(userId);
		expect(usersStore.findById(userId)).toEqual(user);
	});

	it('should throw an error when adding a user fails', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(
			usersStore.add({
				id: userId,
				draft: false,
				data: {
					username: 'jack_doe',
					password: 'password123',
					email: 'jack@example.com',
					firstName: 'Jack',
					lastName: 'Doe',
					role: UsersModuleUserRole.user,
				},
			})
		).rejects.toThrow(UsersApiException);
	});

	it('should edit a user successfully', async (): Promise<void> => {
		usersStore.data[userId] = {
			id: userId,
			username: 'alex_doe',
			email: 'alex@example.com',
			firstName: 'Alex',
			lastName: 'Doe',
			role: UsersModuleUserRole.user,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({
			data: {
				data: {
					id: userId,
					username: 'alex_updated',
					email: 'alex@example.com',
					first_name: 'Alex',
					last_name: 'Doe',
					role: UsersModuleUserRole.admin,
					created_at: '2024-03-01T12:00:00Z',
					updated_at: '2024-03-02T12:00:00Z',
				},
			},
		});

		const updatedUser = await usersStore.edit({
			id: userId,
			data: { username: 'alex_updated', role: UsersModuleUserRole.admin },
		});

		expect(updatedUser.username).toBe('alex_updated');
		expect(usersStore.findById(userId)?.role).toBe(UsersModuleUserRole.admin);
	});

	it('should throw an error when editing a user fails', async (): Promise<void> => {
		usersStore.data[userId] = {
			id: userId,
			username: 'charlie_doe',
			email: 'charlie@example.com',
			firstName: 'Charlie',
			lastName: 'Doe',
			role: UsersModuleUserRole.user,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.PATCH as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(usersStore.edit({ id: userId, data: { username: 'charlie_updated' } })).rejects.toThrow(UsersApiException);
	});

	it('should remove a user successfully', async (): Promise<void> => {
		usersStore.data[userId] = {
			id: userId,
			username: 'dave_doe',
			email: 'dave@example.com',
			firstName: 'Dave',
			lastName: 'Doe',
			role: UsersModuleUserRole.user,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ response: { status: 204 } });

		const result = await usersStore.remove({ id: userId });

		expect(result).toBe(true);
		expect(usersStore.findById(userId)).toBe(null);
	});

	it('should throw an error when removing a user fails', async (): Promise<void> => {
		usersStore.data[userId] = {
			id: userId,
			username: 'eve_doe',
			email: 'eve@example.com',
			firstName: 'Eve',
			lastName: 'Doe',
			role: UsersModuleUserRole.user,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		};

		(backendMock.client.DELETE as Mock).mockResolvedValue({ error: new Error('API error'), response: { status: 404 } });

		await expect(usersStore.remove({ id: userId })).rejects.toThrow(UsersApiException);
	});
});
