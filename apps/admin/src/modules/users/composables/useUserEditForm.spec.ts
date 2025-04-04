import type { FormInstance } from 'element-plus';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { UsersUserRole } from '../../../openapi';
import { FormResult } from '../../auth';
import type { IUser, UsersStore } from '../store';
import { UsersApiException } from '../users.exceptions';

import { useUserEditForm } from './useUserEditForm';

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

describe('useUserEditForm', (): void => {
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
		const formHandler = useUserEditForm({ user: mockUser });

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'updated@example.com';
		formHandler.model.firstName = 'John';
		formHandler.model.lastName = 'Smith';
		formHandler.model.role = UsersUserRole.admin;

		const result = await formHandler.submit();

		expect(result).toBe('saved');
		expect(formHandler.formResult.value).toBe(FormResult.OK);
		expect(usersStoreMock.edit).toHaveBeenCalledWith({
			id: 'user1',
			data: {
				email: 'updated@example.com',
				firstName: 'John',
				lastName: 'Smith',
				role: UsersUserRole.admin,
			},
		});
		expect(usersStoreMock.save).not.toHaveBeenCalled();
		expect(flashMessageMock.success).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should successfully save a draft user (added)', async (): Promise<void> => {
		mockUser.draft = true;

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserEditForm({ user: mockUser });

		(usersStoreMock.edit as Mock).mockResolvedValue({});
		(usersStoreMock.save as Mock).mockResolvedValue({});

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'new@example.com';
		formHandler.model.firstName = 'Jane';
		formHandler.model.lastName = 'Doe';
		formHandler.model.role = UsersUserRole.user;

		const result = await formHandler.submit();

		expect(result).toBe('added');
		expect(formHandler.formResult.value).toBe(FormResult.OK);
		expect(usersStoreMock.edit).toHaveBeenCalled();
		expect(usersStoreMock.save).toHaveBeenCalledWith({ id: 'user1' });
		expect(flashMessageMock.success).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should handle validation error (422)', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockRejectedValue(new UsersApiException('Validation error', 422));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserEditForm({ user: mockUser });

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'invalid-email';
		formHandler.model.firstName = 'John';
		formHandler.model.lastName = 'Doe';
		formHandler.model.role = UsersUserRole.user;

		await expect(formHandler.submit()).rejects.toThrow(UsersApiException);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith('Validation error');

		await flushPromises();
	});

	it('should handle general API error', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockRejectedValue(new Error('Failed to update user'));

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserEditForm({ user: mockUser });

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'test@example.com';
		formHandler.model.firstName = 'John';
		formHandler.model.lastName = 'Doe';
		formHandler.model.role = UsersUserRole.user;

		await expect(formHandler.submit()).rejects.toThrow(Error);

		expect(formHandler.formResult.value).toBe(FormResult.ERROR);
		expect(flashMessageMock.error).toHaveBeenCalledWith(expect.stringContaining('testuser'));

		await flushPromises();
	});

	it('should trim empty optional fields before sending request', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockResolvedValue({});

		const formHandler = useUserEditForm({ user: mockUser });

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = '';
		formHandler.model.firstName = '';
		formHandler.model.lastName = '';
		formHandler.model.role = UsersUserRole.user;

		await formHandler.submit();

		expect(usersStoreMock.edit).toHaveBeenCalledWith({
			id: 'user1',
			data: {
				email: null,
				firstName: null,
				lastName: null,
				role: UsersUserRole.user,
			},
		});

		await flushPromises();
	});

	it('should handle custom success and error messages', async (): Promise<void> => {
		const customMessages = {
			success: 'User successfully updated!',
			error: 'Failed to save user changes.',
		};

		const flashMessageMock = useFlashMessage();
		const formHandler = useUserEditForm({ user: mockUser, messages: customMessages });

		(usersStoreMock.edit as Mock).mockResolvedValue({});

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'custom@example.com';
		formHandler.model.firstName = 'Custom';
		formHandler.model.lastName = 'User';
		formHandler.model.role = UsersUserRole.user;

		await formHandler.submit();

		expect(flashMessageMock.success).toHaveBeenCalledWith('User successfully updated! testuser');

		(usersStoreMock.edit as Mock).mockRejectedValue(new Error());

		formHandler.model.email = 'custom@example.com';
		formHandler.model.firstName = 'Custom';
		formHandler.model.lastName = 'User';
		formHandler.model.role = UsersUserRole.user;

		await expect(formHandler.submit()).rejects.toThrow(Error);

		expect(flashMessageMock.error).toHaveBeenCalledWith('Failed to save user changes.');

		await flushPromises();
	});

	it('should reset form result after timeout', async (): Promise<void> => {
		(usersStoreMock.edit as Mock).mockResolvedValue({});

		const formHandler = useUserEditForm({ user: mockUser });

		formHandler.formEl.value = {
			clearValidate: vi.fn(),
			validate: vi.fn().mockResolvedValue(true),
		} as unknown as FormInstance;

		formHandler.model.email = 'test@example.com';
		formHandler.model.firstName = 'John';
		formHandler.model.lastName = 'Doe';
		formHandler.model.role = UsersUserRole.user;

		await formHandler.submit();

		expect(formHandler.formResult.value).toBe(FormResult.OK);

		vi.runAllTimers();

		expect(formHandler.formResult.value).toBe(FormResult.NONE);
	});
});
