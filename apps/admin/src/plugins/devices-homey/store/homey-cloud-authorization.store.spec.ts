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
		get.mockResolvedValue(success({ connected: true, selected_homey_id: 'homey-b' }));
		const store = useHomeyCloudAuthorization();

		await store.select('homey-b');

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/oauth/select', {
			body: { data: { transaction_id: pending.transactionId, homey_id: 'homey-b' } },
		});
		expect(store.pendingTransaction).toBeNull();
		expect(store.status?.selectedHomeyId).toBe('homey-b');
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

	it('disconnects without exposing or sending stored credentials', async () => {
		post.mockResolvedValue(success({ status: 'disconnected', changed: true, homey_id: null }));
		const store = useHomeyCloudAuthorization();
		store.status = { connected: true, selectedHomeyId: 'homey-id' };

		await store.disconnect();

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/oauth/disconnect');
		expect(store.status).toEqual({ connected: false, selectedHomeyId: null });
	});
});
