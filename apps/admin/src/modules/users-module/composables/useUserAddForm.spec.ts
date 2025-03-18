import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult } from '../../auth-module';
import type { UsersStore } from '../store';
import { UserRole } from '../users.constants';
import { UsersApiException } from '../users.exceptions';

import { useUserAddForm } from './useUserAddForm';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
};

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			add: vi.fn(),
		})),
	})),
	useFlashMessage: vi.fn(() => mockFlash),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: vi.fn((key, params) => `${key}${params?.user ? ' ' + params?.user : ''}`),
	}),
}));

describe('useUserAddForm', (): void => {
	let usersStoreMock: UsersStore;

	beforeEach((): void => {
		vi.useFakeTimers();

		usersStoreMock = {
			add: vi.fn(),
		} as UsersStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => usersStoreMock),
		});

		vi.clearAllMocks();
	});

	afterEach((): void => {
		vi.restoreAllMocks();

		vi.useRealTimers();
	});

	it('should successfully add a user', async (): Promise<void> => {
		(usersStoreMock.add as Mock).mockResolvedValue({});

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserAddForm('test-id');

		const result = await formHandler.submit({
			username: 'testuser',
			password: 'securepass',
			email: 'test@example.com',
			firstName: 'John',
			lastName: 'Doe',
			role: UserRole.USER,
		});

		expect(result).toBe('added');
		expect(formHandler.formResult.value).toBe(FormResult.OK);
		expect(flashMessageMock.success).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should handle validation error (422) when adding a user', async (): Promise<void> => {
		(usersStoreMock.add as Mock).mockRejectedValue(new UsersApiException('Validation error', 422));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserAddForm('test-id');

		await expect(
			formHandler.submit({
				username: 'testuser',
				password: 'securepass',
				email: 'invalid-email',
				firstName: 'John',
				lastName: 'Doe',
				role: UserRole.USER,
			})
		).rejects.toThrow(UsersApiException);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith('Validation error');

		await flushPromises();
	});

	it('should handle general API error when adding a user', async (): Promise<void> => {
		(usersStoreMock.add as Mock).mockRejectedValue(new Error('Failed to add user'));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserAddForm('test-id');

		await expect(
			formHandler.submit({
				username: 'testuser',
				password: 'securepass',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
				role: UserRole.USER,
			})
		).rejects.toThrow(Error);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should trim empty optional fields before sending the request', async (): Promise<void> => {
		(usersStoreMock.add as Mock).mockResolvedValue({});

		const formHandler = useUserAddForm('test-id');

		await formHandler.submit({
			username: 'testuser',
			password: 'securepass',
			email: '',
			firstName: '',
			lastName: '',
			role: UserRole.USER,
		});

		expect(usersStoreMock.add).toHaveBeenCalledWith({
			id: 'test-id',
			draft: false,
			data: {
				username: 'testuser',
				password: 'securepass',
				email: null,
				firstName: null,
				lastName: null,
				role: UserRole.USER,
			},
		});

		await flushPromises();
	});

	it('should reset form result after timeout', async (): Promise<void> => {
		(usersStoreMock.add as Mock).mockResolvedValue({});

		const formHandler = useUserAddForm('test-id');

		await formHandler.submit({
			username: 'testuser',
			password: 'securepass',
			email: 'test@example.com',
			firstName: 'John',
			lastName: 'Doe',
			role: UserRole.USER,
		});

		expect(formHandler.formResult.value).toBe(FormResult.OK);

		vi.runAllTimers();

		expect(formHandler.formResult.value).toBe(FormResult.NONE);
	});
});
