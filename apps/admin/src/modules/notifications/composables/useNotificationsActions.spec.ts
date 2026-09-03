import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationsActions } from './useNotificationsActions';

const mockNotification = { id: '2', title: 'Home Assistant connection lost' };

const mockFindById = vi.fn((id: string) => {
	if (id === '1') return null;
	if (id === '2') return mockNotification;
	return null;
});

const mockMarkRead = vi.fn();
const mockDismiss = vi.fn();
// Baseline "nothing failed" shape, kept across tests the same way `mockFindById` is - individual
// tests override it with `mockResolvedValueOnce`/`mockRejectedValueOnce` for the cases they cover.
const mockBulkUpdate = vi.fn().mockResolvedValue({ succeeded: [], failed: [] });

const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: confirmMock,
		},
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({
				findById: mockFindById,
				markRead: mockMarkRead,
				dismiss: mockDismiss,
				bulkUpdate: mockBulkUpdate,
			}),
		}),
		useFlashMessage: () => ({
			success: mockSuccess,
			error: mockError,
			info: mockInfo,
		}),
	};
});

describe('useNotificationsActions', () => {
	// Clears call history between tests (but keeps `mockFindById`'s baseline implementation,
	// unlike `resetAllMocks`) so an earlier test's call does not leak into a later `not.toHaveBeenCalled()`.
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('markRead', () => {
		it('calls the store and stays quiet on success', async () => {
			const { markRead } = useNotificationsActions();

			await markRead('2');

			expect(mockMarkRead).toHaveBeenCalledWith({ id: '2', read: true });
			expect(mockSuccess).not.toHaveBeenCalled();
			expect(mockError).not.toHaveBeenCalled();
		});

		it('flashes an error when the request fails', async () => {
			mockMarkRead.mockRejectedValueOnce(new Error('boom'));

			const { markRead } = useNotificationsActions();

			await markRead('2', false);

			expect(mockMarkRead).toHaveBeenCalledWith({ id: '2', read: false });
			expect(mockError).toHaveBeenCalled();
		});
	});

	describe('markAllRead', () => {
		it('does nothing for an empty selection', async () => {
			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead([]);

			expect(mockBulkUpdate).not.toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('bulk-updates the given ids and reports success when every id succeeds', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2', '3'], failed: [] });

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2', '3']);

			expect(mockBulkUpdate).toHaveBeenCalledWith({ ids: ['2', '3'], read: true });
			expect(mockError).not.toHaveBeenCalled();
			expect(result).toBe(true);
		});

		// The request itself can succeed (200 OK) while individual rows in the batch are refused -
		// that must not be silently swallowed, or "Mark all as read" can leave rows unread with no
		// sign anything went wrong.
		it('flashes an error and reports failure when some ids fail', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2'], failed: [{ id: '3', reason: 'Notification not found.' }] });

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2', '3']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe(false);
		});

		it('flashes an error and reports failure when the bulk request itself fails', async () => {
			mockBulkUpdate.mockRejectedValueOnce(new Error('boom'));

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2', '3']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe(false);
		});
	});

	describe('dismiss', () => {
		it('does nothing when the notification cannot be found', async () => {
			const { dismiss } = useNotificationsActions();

			await dismiss('1');

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockDismiss).not.toHaveBeenCalled();
		});

		it('confirms before dismissing, in a separate try block from the request', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockDismiss.mockResolvedValueOnce(mockNotification);

			const { dismiss } = useNotificationsActions();

			await dismiss('2');

			expect(confirmMock).toHaveBeenCalled();
			expect(mockDismiss).toHaveBeenCalledWith({ id: '2', dismissed: true });
			expect(mockSuccess).toHaveBeenCalled();
		});

		it('never calls the store when the confirmation is cancelled', async () => {
			confirmMock.mockRejectedValueOnce(new Error('cancel'));

			const { dismiss } = useNotificationsActions();

			await dismiss('2');

			expect(confirmMock).toHaveBeenCalled();
			expect(mockDismiss).not.toHaveBeenCalled();
			expect(mockInfo).toHaveBeenCalled();
		});

		it('flashes an error, not a cancellation, when the confirmed request fails', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockDismiss.mockRejectedValueOnce(new Error('boom'));

			const { dismiss } = useNotificationsActions();

			await dismiss('2');

			expect(mockDismiss).toHaveBeenCalledWith({ id: '2', dismissed: true });
			expect(mockError).toHaveBeenCalled();
			expect(mockInfo).not.toHaveBeenCalled();
		});
	});
});
