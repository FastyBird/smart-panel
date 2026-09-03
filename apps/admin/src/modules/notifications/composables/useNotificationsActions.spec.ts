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
const mockRemove = vi.fn();
const mockBulkUpdate = vi.fn().mockResolvedValue({ succeeded: [], failed: [] });
const mockBulkRemove = vi.fn();

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
				remove: mockRemove,
				bulkUpdate: mockBulkUpdate,
				bulkRemove: mockBulkRemove,
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
		// `result` reports whether anything actually mutated (so a caller can decide whether to
		// refresh its list), not whether the whole batch was error-free - an empty selection never
		// calls the store, so nothing mutated.
		it('does nothing for an empty selection and reports no mutation', async () => {
			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead([]);

			expect(mockBulkUpdate).not.toHaveBeenCalled();
			expect(result).toBe(false);
		});

		it('bulk-updates the given ids and reports a mutation when every id succeeds', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2', '3'], failed: [] });

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2', '3']);

			expect(mockBulkUpdate).toHaveBeenCalledWith({ ids: ['2', '3'], read: true });
			expect(mockError).not.toHaveBeenCalled();
			expect(result).toBe(true);
		});

		// The request itself can succeed (200 OK) while individual rows in the batch are refused -
		// that must not be silently swallowed, or "Mark all as read" can leave rows unread with no
		// sign anything went wrong. The rows that DID succeed still mutated the list, though, so a
		// caller still needs to know to refresh it.
		it('flashes an error yet still reports a mutation when some ids fail and others succeed', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2'], failed: [{ id: '3', reason: 'Notification not found.' }] });

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2', '3']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('flashes an error and reports no mutation when every id in the batch fails', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: [], failed: [{ id: '2', reason: 'Notification not found.' }] });

			const { markAllRead } = useNotificationsActions();

			const result = await markAllRead(['2']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe(false);
		});

		it('flashes an error and reports no mutation when the bulk request itself fails', async () => {
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

	describe('remove', () => {
		it('does nothing when the notification cannot be found', async () => {
			const { remove } = useNotificationsActions();

			await remove('1');

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockRemove).not.toHaveBeenCalled();
		});

		it('confirms before removing, in a separate try block from the request', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockRemove.mockResolvedValueOnce(undefined);

			const { remove } = useNotificationsActions();

			await remove('2');

			expect(confirmMock).toHaveBeenCalled();
			expect(mockRemove).toHaveBeenCalledWith({ id: '2' });
			expect(mockSuccess).toHaveBeenCalled();
		});

		it('never calls the store when the confirmation is cancelled', async () => {
			confirmMock.mockRejectedValueOnce(new Error('cancel'));

			const { remove } = useNotificationsActions();

			await remove('2');

			expect(confirmMock).toHaveBeenCalled();
			expect(mockRemove).not.toHaveBeenCalled();
			expect(mockInfo).toHaveBeenCalled();
		});

		it('flashes an error, not a cancellation, when the confirmed request fails', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockRemove.mockRejectedValueOnce(new Error('boom'));

			const { remove } = useNotificationsActions();

			await remove('2');

			expect(mockError).toHaveBeenCalled();
			expect(mockInfo).not.toHaveBeenCalled();
		});
	});

	describe('bulkMarkUnread', () => {
		it('does nothing for an empty selection and reports it as cancelled', async () => {
			const { bulkMarkUnread } = useNotificationsActions();

			const result = await bulkMarkUnread([]);

			expect(mockBulkUpdate).not.toHaveBeenCalled();
			expect(result).toBe('cancelled');
		});

		it('bulk-updates the given ids without confirming, quiet on success, and reports a mutation', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2', '3'], failed: [] });

			const { bulkMarkUnread } = useNotificationsActions();

			const result = await bulkMarkUnread(['2', '3']);

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockBulkUpdate).toHaveBeenCalledWith({ ids: ['2', '3'], read: false });
			expect(mockSuccess).not.toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		// The request can resolve (200 OK) while carrying per-row failures in `result.failed` -
		// previously ignored entirely. Rows that did succeed still mutated the list.
		it('flashes an error yet still reports a mutation when some ids fail and others succeed', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2'], failed: [{ id: '3', reason: 'Notification not found.' }] });

			const { bulkMarkUnread } = useNotificationsActions();

			const result = await bulkMarkUnread(['2', '3']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		it('flashes an error and reports failure when every id in the batch fails', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: [], failed: [{ id: '2', reason: 'Notification not found.' }] });

			const { bulkMarkUnread } = useNotificationsActions();

			const result = await bulkMarkUnread(['2']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('failed');
		});

		it('flashes an error and reports failure when the request itself fails', async () => {
			mockBulkUpdate.mockRejectedValueOnce(new Error('boom'));

			const { bulkMarkUnread } = useNotificationsActions();

			const result = await bulkMarkUnread(['2']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('failed');
		});
	});

	describe('bulkDismiss', () => {
		it('does nothing for an empty selection and reports it as cancelled', async () => {
			const { bulkDismiss } = useNotificationsActions();

			const result = await bulkDismiss([]);

			expect(mockBulkUpdate).not.toHaveBeenCalled();
			expect(result).toBe('cancelled');
		});

		it('bulk-updates the given ids without confirming and reports a mutation', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2', '3'], failed: [] });

			const { bulkDismiss } = useNotificationsActions();

			const result = await bulkDismiss(['2', '3']);

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockBulkUpdate).toHaveBeenCalledWith({ ids: ['2', '3'], dismissed: true });
			expect(mockSuccess).toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		// Previously ignored `result.failed` entirely and always flashed success, even when every
		// row in a 200-OK response had actually failed.
		it('does not flash success and reports failure when every id in the batch fails', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: [], failed: [{ id: '2', reason: 'Notification not found.' }] });

			const { bulkDismiss } = useNotificationsActions();

			const result = await bulkDismiss(['2']);

			expect(mockSuccess).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('failed');
		});

		it('flashes both success and error for a partial batch, and still reports a mutation', async () => {
			mockBulkUpdate.mockResolvedValueOnce({ succeeded: ['2'], failed: [{ id: '3', reason: 'Notification not found.' }] });

			const { bulkDismiss } = useNotificationsActions();

			const result = await bulkDismiss(['2', '3']);

			expect(mockSuccess).toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		it('flashes an error and reports failure when the request itself fails', async () => {
			mockBulkUpdate.mockRejectedValueOnce(new Error('boom'));

			const { bulkDismiss } = useNotificationsActions();

			const result = await bulkDismiss(['2']);

			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('failed');
		});
	});

	describe('bulkRemove', () => {
		it('does nothing for an empty selection and reports it as cancelled', async () => {
			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove([]);

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockBulkRemove).not.toHaveBeenCalled();
			expect(result).toBe('cancelled');
		});

		it('confirms before removing, in a separate try block from the request, and reports a mutation', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockBulkRemove.mockResolvedValueOnce({ succeeded: ['2', '3'], failed: [] });

			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove(['2', '3']);

			expect(confirmMock).toHaveBeenCalled();
			expect(mockBulkRemove).toHaveBeenCalledWith({ ids: ['2', '3'] });
			expect(mockSuccess).toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		it('never calls the store when the confirmation is cancelled, and reports it as cancelled', async () => {
			confirmMock.mockRejectedValueOnce(new Error('cancel'));

			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove(['2']);

			expect(confirmMock).toHaveBeenCalled();
			expect(mockBulkRemove).not.toHaveBeenCalled();
			expect(mockInfo).toHaveBeenCalled();
			expect(result).toBe('cancelled');
		});

		it('flashes an error, not a cancellation, and reports failure when the confirmed request fails', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockBulkRemove.mockRejectedValueOnce(new Error('boom'));

			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove(['2']);

			expect(mockError).toHaveBeenCalled();
			expect(mockInfo).not.toHaveBeenCalled();
			expect(result).toBe('failed');
		});

		it('reports partial failures from a mixed bulk result, and still reports a mutation', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockBulkRemove.mockResolvedValueOnce({ succeeded: ['2'], failed: [{ id: '3', reason: 'not found' }] });

			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove(['2', '3']);

			expect(mockSuccess).toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('mutated');
		});

		it('does not flash success and reports failure when every id in the batch fails', async () => {
			confirmMock.mockResolvedValueOnce(undefined);
			mockBulkRemove.mockResolvedValueOnce({ succeeded: [], failed: [{ id: '2', reason: 'not found' }] });

			const { bulkRemove } = useNotificationsActions();

			const result = await bulkRemove(['2']);

			expect(mockSuccess).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
			expect(result).toBe('failed');
		});
	});
});
