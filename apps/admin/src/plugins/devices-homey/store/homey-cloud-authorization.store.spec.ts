import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY } from '../devices-homey.constants';
import { DevicesHomeyApiException } from '../devices-homey.exceptions';

import { useHomeyCloudAuthorization } from './homey-cloud-authorization.store';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		getErrorReason: () => 'Sanitized Homey Cloud request failure',
	};
});

const success = (data: Record<string, unknown>) => ({ data: { data }, response: { status: 200 } });
const pending = {
	transactionId: 'transaction-id',
	expiresAt: '2099-08-30T12:00:00.000Z',
};

describe('Homey Cloud authorization store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.restoreAllMocks();
		vi.clearAllMocks();
		window.sessionStorage.clear();
	});

	it('starts without a cached transaction when browser policy blocks session storage', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('Blocked by browser policy', 'SecurityError');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new DOMException('Blocked by browser policy', 'SecurityError');
		});

		expect(() => useHomeyCloudAuthorization()).not.toThrow();
		expect(useHomeyCloudAuthorization().pendingTransaction).toBeNull();
	});

	it('loads credential-free authorization status', async () => {
		get.mockResolvedValue(success({ connected: true, selected_homey_id: 'homey-id' }));
		const store = useHomeyCloudAuthorization();

		await expect(store.fetchStatus()).resolves.toEqual({ connected: true, selectedHomeyId: 'homey-id' });
		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/oauth/status');
	});

	it('invalidates a cached status without changing the pending authorization', () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		const store = useHomeyCloudAuthorization();
		store.status = { connected: true, selectedHomeyId: 'homey-id' };

		store.invalidateStatus();

		expect(store.status).toBeNull();
		expect(store.pendingTransaction).toEqual(pending);
	});

	it('persists only the opaque transaction reference before navigation', async () => {
		post.mockResolvedValue(
			success({
				authorize_url: 'https://api.athom.com/oauth2/authorise?state=provider-state',
				transaction_id: pending.transactionId,
				expires_at: pending.expiresAt,
			})
		);
		const store = useHomeyCloudAuthorization();

		await expect(store.start()).resolves.toEqual(
			expect.objectContaining({ transactionId: pending.transactionId, authorizeUrl: expect.stringContaining('api.athom.com') })
		);
		expect(JSON.parse(window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY) ?? '{}')).toEqual(pending);
		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/oauth/authorize', {});
	});

	it('cancels a newly started transaction when browser storage cannot persist it', async () => {
		post
			.mockResolvedValueOnce(
				success({
					authorize_url: 'https://api.athom.com/oauth2/authorise?state=provider-state',
					transaction_id: pending.transactionId,
					expires_at: pending.expiresAt,
				})
			)
			.mockResolvedValueOnce(success({ status: 'cancelled', changed: true, homey_id: null }));
		const store = useHomeyCloudAuthorization();
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
		});

		await expect(store.start()).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({
				message: 'Browser session storage is required for Homey Cloud authorization.',
			})
		);
		expect(post).toHaveBeenNthCalledWith(2, '/plugins/devices-homey/oauth/cancel', {
			body: { data: { transaction_id: pending.transactionId } },
		});
		expect(store.pendingTransaction).toBeNull();
		expect(store.authorizing).toBe(false);
	});

	it('resumes a multiple-Homey callback from page-scoped storage', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		get.mockResolvedValue(
			success({
				status: 'selection_required',
				homey_id: null,
				homeys: [
					{ id: 'homey-a', name: 'Home' },
					{ id: 'homey-b', name: 'Cabin' },
				],
			})
		);
		const store = useHomeyCloudAuthorization();

		await expect(store.resume()).resolves.toEqual({
			status: 'selection_required',
			homeyId: null,
			homeys: [
				{ id: 'homey-a', name: 'Home' },
				{ id: 'homey-b', name: 'Cabin' },
			],
		});
		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/oauth/transactions/{transactionId}/homeys', {
			params: { path: { transactionId: pending.transactionId } },
		});
	});

	it('lets the backend decide whether a locally expired transaction remains resumable', async () => {
		const callbackTransaction = { ...pending, expiresAt: '2000-08-30T12:00:00.000Z' };
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(callbackTransaction));
		get.mockResolvedValue(success({ status: 'selection_required', homey_id: null, homeys: [{ id: 'homey-a', name: 'Home' }] }));
		const store = useHomeyCloudAuthorization();

		await expect(store.resume()).resolves.toEqual({
			status: 'selection_required',
			homeyId: null,
			homeys: [{ id: 'homey-a', name: 'Home' }],
		});
		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/oauth/transactions/{transactionId}/homeys', {
			params: { path: { transactionId: pending.transactionId } },
		});
	});

	it('accepts completion only when the exact transaction activated', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		get.mockResolvedValue(success({ status: 'connected', homey_id: 'homey-id', homeys: [] }));
		const store = useHomeyCloudAuthorization();

		await expect(store.resume()).resolves.toEqual({ status: 'connected', homeyId: 'homey-id', homeys: [] });
		expect(store.pendingTransaction).toBeNull();
		expect(store.status).toEqual({ connected: true, selectedHomeyId: 'homey-id' });
		expect(window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY)).toBeNull();
	});

	it.each([
		{ status: 'connected', homey_id: 'homey-id', homeys: [] },
		{ status: 'selection_required', homey_id: null, homeys: [{ id: 'homey-a', name: 'Home' }] },
	])('discards a stale $status resume result after the pending transaction changes', async (result) => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		let completeRequest: ((value: ReturnType<typeof success>) => void) | undefined;
		get.mockReturnValueOnce(
			new Promise((resolve) => {
				completeRequest = resolve;
			})
		);
		const store = useHomeyCloudAuthorization();
		const resume = store.resume();
		const replacement = { transactionId: 'replacement-transaction-id', expiresAt: pending.expiresAt };
		store.pendingTransaction = replacement;

		completeRequest?.(success(result));

		await expect(resume).resolves.toBeNull();
		expect(store.pendingTransaction).toEqual(replacement);
		expect(store.homeys).toEqual([]);
		expect(store.status).toBeNull();
	});

	it('reports a consumed callback as failed unless that exact transaction activated', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		get.mockResolvedValue({ error: {}, response: { status: 409 } });
		const store = useHomeyCloudAuthorization();

		await expect(store.resume()).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({ message: 'Sanitized Homey Cloud request failure', code: 409 })
		);
		expect(store.pendingTransaction).toBeNull();
	});

	it('selects one eligible Homey and clears the transaction', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue(success({ status: 'connected', changed: true, homey_id: 'homey-b' }));
		const store = useHomeyCloudAuthorization();

		await expect(store.select('homey-b')).resolves.toEqual({ status: 'connected', changed: true, homeyId: 'homey-b' });

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/oauth/select', {
			body: { data: { transaction_id: pending.transactionId, homey_id: 'homey-b' } },
		});
		expect(get).not.toHaveBeenCalled();
		expect(store.pendingTransaction).toBeNull();
		expect(store.status).toEqual({ connected: true, selectedHomeyId: 'homey-b' });
	});

	it('does not let a stale status response overwrite a completed selection', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		let completeStatus: ((value: ReturnType<typeof success>) => void) | undefined;
		get.mockReturnValueOnce(
			new Promise((resolve) => {
				completeStatus = resolve;
			})
		);
		post.mockResolvedValue(success({ status: 'connected', changed: true, homey_id: 'homey-b' }));
		const store = useHomeyCloudAuthorization();
		const statusRequest = store.fetchStatus();

		await store.select('homey-b');
		completeStatus?.(success({ connected: false, selected_homey_id: null }));
		await statusRequest;

		expect(store.status).toEqual({ connected: true, selectedHomeyId: 'homey-b' });
	});

	it('recovers a committed selection when its response was lost', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue({ error: {}, response: { status: 409 } });
		get.mockResolvedValue(success({ status: 'connected', homey_id: 'homey-b', homeys: [] }));
		const store = useHomeyCloudAuthorization();

		await expect(store.select('homey-b')).resolves.toEqual({ status: 'connected', changed: false, homeyId: 'homey-b' });

		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/oauth/transactions/{transactionId}/homeys', {
			params: { path: { transactionId: pending.transactionId } },
		});
		expect(store.pendingTransaction).toBeNull();
		expect(store.status).toEqual({ connected: true, selectedHomeyId: 'homey-b' });
	});

	it('retains a selection transaction when completion verification fails transiently', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue({ error: {}, response: { status: 409 } });
		get.mockResolvedValue({ error: new Error('private provider detail'), response: { status: 503 } });
		const store = useHomeyCloudAuthorization();

		await expect(store.select('homey-b')).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({ message: 'Sanitized Homey Cloud request failure', code: 503 })
		);

		expect(store.pendingTransaction).toEqual(pending);
		expect(window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY)).not.toBeNull();
	});

	it('refreshes the remaining choices after a selected Homey is rejected', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue({ error: {}, response: { status: 400 } });
		get.mockResolvedValue(success({ status: 'selection_required', homey_id: null, homeys: [{ id: 'homey-c', name: 'Remaining Homey' }] }));
		const store = useHomeyCloudAuthorization();

		await expect(store.select('homey-b')).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({ message: 'Sanitized Homey Cloud request failure', code: 400 })
		);

		expect(store.pendingTransaction).toEqual(pending);
		expect(store.homeys).toEqual([{ id: 'homey-c', name: 'Remaining Homey' }]);
		expect(window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY)).not.toBeNull();
	});

	it('retains a transaction for a retryable provider failure', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		get.mockResolvedValue({ error: new Error('private provider detail'), response: { status: 503 } });
		const store = useHomeyCloudAuthorization();

		await expect(store.resume()).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({ message: 'Sanitized Homey Cloud request failure', code: 503 })
		);
		expect(store.pendingTransaction).toEqual(pending);
	});

	it('refreshes an unknown grant status after cancelling an authorization', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue(success({ status: 'cancelled', changed: true, homey_id: null }));
		get.mockResolvedValue(success({ connected: true, selected_homey_id: 'active-homey' }));
		const store = useHomeyCloudAuthorization();

		await expect(store.cancel()).resolves.toEqual({ status: 'cancelled', changed: true, homeyId: null });

		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/oauth/status');
		expect(store.pendingTransaction).toBeNull();
		expect(store.status).toEqual({ connected: true, selectedHomeyId: 'active-homey' });
	});

	it('preserves a successful cancellation when its status refresh fails', async () => {
		window.sessionStorage.setItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY, JSON.stringify(pending));
		post.mockResolvedValue(success({ status: 'cancelled', changed: true, homey_id: null }));
		get.mockResolvedValue({ error: new Error('private provider detail'), response: { status: 503 } });
		const store = useHomeyCloudAuthorization();

		await expect(store.cancel()).resolves.toEqual({ status: 'cancelled', changed: true, homeyId: null });

		expect(store.pendingTransaction).toBeNull();
		expect(store.status).toBeNull();
		expect(window.sessionStorage.getItem(HOMEY_CLOUD_AUTHORIZATION_STORAGE_KEY)).toBeNull();
	});

	it('disconnects without exposing or sending stored credentials', async () => {
		post.mockResolvedValue(success({ status: 'disconnected', changed: true, homey_id: null }));
		const store = useHomeyCloudAuthorization();
		store.status = { connected: true, selectedHomeyId: 'homey-id' };

		await store.disconnect();

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/oauth/disconnect');
		expect(store.status).toEqual({ connected: false, selectedHomeyId: null });
	});

	it('does not let a stale status response overwrite a completed disconnect', async () => {
		let completeStatus: ((value: ReturnType<typeof success>) => void) | undefined;
		get.mockReturnValueOnce(
			new Promise((resolve) => {
				completeStatus = resolve;
			})
		);
		post.mockResolvedValue(success({ status: 'disconnected', changed: true, homey_id: null }));
		const store = useHomeyCloudAuthorization();
		store.status = { connected: true, selectedHomeyId: 'homey-id' };
		const statusRequest = store.fetchStatus();

		await store.disconnect();
		completeStatus?.(success({ connected: true, selected_homey_id: 'homey-id' }));
		await statusRequest;

		expect(store.status).toEqual({ connected: false, selectedHomeyId: null });
	});
});
