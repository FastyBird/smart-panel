import type { FormInstance } from 'element-plus';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { UsersUserRole } from '../../../openapi';
import { FormResult } from '../../auth';
import type { IUser, UsersStore } from '../store';
import { UsersApiException } from '../users.exceptions';

import { useUserUsernameForm } from './useUserUsernameForm';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
};

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			edit: vi.fn(),
			save: vi.fn(),
		})),
	})),
	useFlashMessage: vi.fn(() => mockFlash),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: vi.fn((key, params) => `${key}${params?.user ? ' ' + params?.user : ''}`),
	}),
}));

describe('useUserUsernameForm', (): void => {
	let usersStoreMock: UsersStore;
	let mockUser: IUser;

	beforeEach((): void => {
		vi.useFakeTimers();

		usersStoreMock = {
			edit: vi.fn(),
			save: vi.fn(),
		} as UsersStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => usersStoreMock),
		});

		vi.clearAllMocks();

		mockUser = {
			id: 'user1',
			username: 'testuser',
			email: 'test@example.com',
			firstName: 'John',
			lastName: 'Doe',
			role: UsersUserRole.user,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		};
	});

	afterEach((): void => {
		vi.restoreAllMocks();

		vi.useRealTimers();
	});

	it('should successfully edit a user (saved)', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockResolvedValue({});
		(usersStoreMock.save as Mock).mockResolvedValue({});

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserUsernameForm(mockUser);

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.username = 'username';

		const result = await formHandler.submit();

		expect(result).toBe('saved');
		expect(formHandler.formResult.value).toBe(FormResult.OK);
		expect(usersStoreMock.edit).toHaveBeenCalledWith({
			id: 'user1',
			data: {
				username: 'username',
			},
		});
		expect(usersStoreMock.save).not.toHaveBeenCalled();
		expect(flashMessageMock.success).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should handle validation error (422)', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockRejectedValue(new UsersApiException('Validation error', 422));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserUsernameForm(mockUser);

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.username = 'username';

		await expect(formHandler.submit()).rejects.toThrow(UsersApiException);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith('Validation error');

		await flushPromises();
	});

	it('should handle general API error', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockRejectedValue(new Error('Failed to update user'));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserUsernameForm(mockUser);

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.username = 'username';

		await expect(formHandler.submit()).rejects.toThrow(Error);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should handle custom success and error messages', async (): Promise<void> => {
		const customMessages = {
			success: 'User successfully updated!',
			error: 'Failed to save user changes.',
		};

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserUsernameForm(mockUser, customMessages);

		(usersStoreMock.edit as Mock).mockResolvedValue({});

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.username = 'username';

		await formHandler.submit();

		expect(flashMessageMock.success).toHaveBeenCalledWith('User successfully updated! testuser');

		(usersStoreMock.edit as Mock).mockRejectedValue(new Error());

		formHandler.model.username = 'username';

		await expect(formHandler.submit()).rejects.toThrow(Error);

		expect(flashMessageMock.error).toHaveBeenCalledWith('Failed to save user changes.');

		await flushPromises();
	});

	it('should reset form result after timeout', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockResolvedValue({});

		const formHandler = useUserUsernameForm(mockUser);

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.username = 'username';

		await formHandler.submit();

		expect(formHandler.formResult.value).toBe(FormResult.OK);

		vi.runAllTimers();

		expect(formHandler.formResult.value).toBe(FormResult.NONE);
	});
});
