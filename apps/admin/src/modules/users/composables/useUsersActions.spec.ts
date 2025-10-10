import { ElMessageBox } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { UsersStore } from '../store/users.store.types';
import { UsersApiException, UsersException } from '../users.exceptions';

import { useUsersActions } from './useUsersActions';

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: vi.fn(),
		},
	};
});

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: vi.fn((key, params) => `${key}${params?.user ? ' ' + params?.user : ''}`),
	}),
}));

describe('useUsersActions', (): void => {
	let usersStoreMock: UsersStore;

	beforeEach((): void => {
		usersStoreMock = {
			findById: vi.fn(),
			remove: vi.fn().mockResolvedValue(undefined),
		} as UsersStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => usersStoreMock),
		});

		vi.clearAllMocks();
	});

	it('should throw an exception if the user is not found', async (): Promise<void> => {
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue(null);

		await expect(remove('user1')).rejects.toThrow(UsersException);
	});

	it('should confirm removal using ElMessageBox.confirm', async (): Promise<void> => {
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledWith('usersModule.texts.confirmRemove testuser', 'usersModule.headings.remove', {
			confirmButtonText: 'usersModule.buttons.yes.title',
			cancelButtonText: 'usersModule.buttons.no.title',
			type: 'warning',
		});
	});

	it('should call usersStore.remove when confirmed', async (): Promise<void> => {
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(usersStoreMock.remove).toHaveBeenCalledWith({ id: 'user1' });
	});

	it('should display a success message on successful removal', async (): Promise<void> => {
		const flashMessageMock = useFlashMessage();
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(flashMessageMock.success).toHaveBeenCalledWith('usersModule.messages.removed testuser');
	});

	it('should handle 404 errors properly and display notFound message', async (): Promise<void> => {
		const flashMessageMock = useFlashMessage();
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });
		(usersStoreMock.remove as Mock).mockRejectedValue(new UsersApiException('User not found', 404));

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(flashMessageMock.error).toHaveBeenCalledWith('usersModule.messages.notFound testuser');
	});

	it('should handle 422 errors and display received error message', async (): Promise<void> => {
		const flashMessageMock = useFlashMessage();
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });
		(usersStoreMock.remove as Mock).mockRejectedValue(new UsersApiException('Validation failed', 422));

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(flashMessageMock.error).toHaveBeenCalledWith('Validation failed');
	});

	it('should display a notRemoved message on unexpected errors', async (): Promise<void> => {
		const flashMessageMock = useFlashMessage();
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });
		(usersStoreMock.remove as Mock).mockRejectedValue(new Error('Unexpected error'));

		(ElMessageBox.confirm as Mock).mockResolvedValue(true);

		await remove('user1');

		await flushPromises();

		expect(flashMessageMock.error).toHaveBeenCalledWith('usersModule.messages.notRemoved testuser');
	});

	it('should handle cancel event and display removeCanceled message', async (): Promise<void> => {
		const flashMessageMock = useFlashMessage();
		const { remove } = useUsersActions();

		(usersStoreMock.findById as Mock).mockReturnValue({ id: 'user1', username: 'testuser' });

		(ElMessageBox.confirm as Mock).mockRejectedValue(new Error('Cancelled'));

		await remove('user1');

		await flushPromises();

		expect(flashMessageMock.info).toHaveBeenCalledWith('usersModule.messages.removeCanceled testuser');
	});
});
