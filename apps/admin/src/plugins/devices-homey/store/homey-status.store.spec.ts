import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesHomeyPluginTestCandidateConnectionMode, DevicesHomeyPluginTestSavedConnectionMode } from '../../../openapi.constants';
import { DevicesHomeyApiException } from '../devices-homey.exceptions';

import { useHomeyStatus } from './homey-status.store';

const get = vi.fn();
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		getErrorReason: () => 'Sanitized Homey request failure',
	};
});

const statusResponse = {
	data: {
		data: {
			service_state: 'started',
			connection_state: 'connected',
			enabled: true,
			configured: true,
			healthy: true,
			degraded: false,
			homey_name: 'Test Homey',
			homey_version: '13.4.0',
			last_inventory_sync_at: '2026-08-24T12:00:00.000Z',
			adopted_device_count: 2,
			missing_device_count: 0,
			unsupported_device_count: 1,
			unavailable_device_count: 0,
			reconnect_count: 0,
			reconciliation_count: 3,
			reconciliation_failure_count: 0,
		},
	},
	response: { status: 200 },
};

const testResponse = (overrides: Record<string, unknown> = {}) => ({
	data: {
		data: {
			mode: 'saved',
			success: true,
			homey_name: 'Test Homey',
			homey_version: '13.4.0',
			...overrides,
		},
	},
	response: { status: 200 },
});

describe('Homey status store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('starts idle without publishing stale status or test results', () => {
		const store = useHomeyStatus();

		expect(store.status).toBeNull();
		expect(store.lastTest).toBeNull();
		expect(store.fetching).toBe(false);
		expect(store.testing).toBe(false);
	});

	it('clears a retained connection test result explicitly', () => {
		const store = useHomeyStatus();
		store.lastTest = { mode: 'saved', success: true };

		store.clearLastTest();

		expect(store.lastTest).toBeNull();
	});

	it('loads and normalizes the current connector status', async () => {
		get.mockResolvedValue(statusResponse);
		const store = useHomeyStatus();

		await expect(store.fetch()).resolves.toEqual(expect.objectContaining({ connectionState: 'connected', configured: true }));

		expect(get).toHaveBeenCalledWith('/plugins/devices-homey/status');
		expect(store.status?.homeyName).toBe('Test Homey');
		expect(store.fetching).toBe(false);
	});

	it('sends a saved test without candidate connector fields', async () => {
		post.mockResolvedValue(testResponse());
		const store = useHomeyStatus();

		await store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } });

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/test-connection', {
			body: { data: { mode: 'saved' } },
		});
		expect(store.lastTest).toEqual(expect.objectContaining({ mode: 'saved', success: true }));
	});

	it('sends only the complete newly entered candidate identity and key', async () => {
		post.mockResolvedValue(testResponse({ mode: 'candidate' }));
		const store = useHomeyStatus();
		const payload = {
			data: {
				mode: DevicesHomeyPluginTestCandidateConnectionMode.candidate,
				url: 'http://homey.local:4859',
				api_key: 'new-candidate-key',
			},
		};

		await store.testConnection(payload);

		expect(post).toHaveBeenCalledWith('/plugins/devices-homey/test-connection', { body: payload });
		expect(store.lastTest?.mode).toBe('candidate');
	});

	it('exposes working state, clears the previous result, and publishes a categorized failure', async () => {
		let completeRequest: ((value: ReturnType<typeof testResponse>) => void) | undefined;
		post.mockReturnValue(
			new Promise<ReturnType<typeof testResponse>>((resolve) => {
				completeRequest = resolve;
			})
		);
		const store = useHomeyStatus();
		store.lastTest = {
			mode: 'saved',
			success: true,
		};

		const request = store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } });

		expect(store.testing).toBe(true);
		expect(store.lastTest).toBeNull();

		completeRequest?.(
			testResponse({
				success: false,
				error_category: 'authorization',
				error: 'The Homey API key does not have the required permissions.',
			})
		);
		await request;

		expect(store.testing).toBe(false);
		expect(store.lastTest).toEqual(expect.objectContaining({ success: false, errorCategory: 'authorization', error: expect.any(String) }));
	});

	it('restores idle state after a transport failure', async () => {
		post.mockResolvedValue({ error: new Error('private transport detail'), response: { status: 503 } });
		const store = useHomeyStatus();

		await expect(store.testConnection({ data: { mode: DevicesHomeyPluginTestSavedConnectionMode.saved } })).rejects.toEqual(
			expect.objectContaining<Partial<DevicesHomeyApiException>>({ message: 'Sanitized Homey request failure', code: 503 })
		);
		expect(store.testing).toBe(false);
		expect(store.lastTest).toBeNull();
	});
});
