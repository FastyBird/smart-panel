import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory, DevicesModuleDeviceConnectionStatus, DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';

import { useDevices } from './devices.store';
import type { IDeviceRes } from './devices.store.types';

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

// Permissive: this spec only exercises `fetch()`'s own dedup/staleness handling, not what ends up in
// the related controls/channels stores, so every key gets the same push-able, no-op-set stub.
const mockGetStore = vi.fn(() => ({
	firstLoad: [] as string[],
	set: vi.fn(),
	unset: vi.fn(),
}));

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');
	const composables = await vi.importActual('../../../common/composables/composables');
	const services = await vi.importActual('../../../common/services/services');
	const store = await vi.importActual('../../../common/store/stores');
	const constants = await vi.importActual('../../../common/common.constants');

	return {
		...utils,
		...composables,
		...services,
		...store,
		...constants,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectStoresManager: vi.fn(() => ({
			getStore: mockGetStore,
		})),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: vi.fn(() => []),
		})),
	};
});

vi.mock('../../config', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../config')>()),
	useConfigPlugins: () => ({
		enabled: () => true,
		loaded: { value: true },
	}),
}));

const deviceFixture = (name: string): IDeviceRes =>
	({
		id: uuid(),
		type: 'some-device',
		category: DevicesModuleDeviceCategory.generic,
		identifier: null,
		name,
		description: null,
		enabled: true,
		hidden: false,
		room_id: null,
		zone_ids: [],
		status: {
			online: false,
			status: DevicesModuleDeviceConnectionStatus.unknown,
			last_changed: null,
		},
		created_at: '2024-03-01T12:00:00Z',
		updated_at: null,
		controls: [],
		channels: [],
	}) as unknown as IDeviceRes;

describe('Devices Store', () => {
	let store: ReturnType<typeof useDevices>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useDevices();

		vi.clearAllMocks();
	});

	it('applies only the most recently requested hidden value when two fetches overlap and resolve out of order', async () => {
		// Two independently-resolvable responses, standing in for the device list's mount fetch
		// (hidden=false) racing the "show hidden" toggle flipping to hidden=all before the mount
		// fetch has returned — the exact scenario a shared, unkeyed in-flight cache used to collapse.
		let resolveFalseRequest!: (value: unknown) => void;
		let resolveAllRequest!: (value: unknown) => void;

		const falseRequest = new Promise((resolve) => {
			resolveFalseRequest = resolve;
		});
		const allRequest = new Promise((resolve) => {
			resolveAllRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(falseRequest).mockReturnValueOnce(allRequest);

		// Mount fetch starts first …
		const olderFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });
		// … the toggle flips before it returns, issuing a second, distinct request.
		const newerFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);

		// The newer (hidden=all) request resolves first.
		resolveAllRequest({ data: { data: [deviceFixture('all-device')] } });
		await newerFetch;

		expect(store.findAll().map((device) => device.name)).toEqual(['all-device']);

		// The older (hidden=false) request resolves after — out of arrival order — and must not
		// clobber the result the newer, still-relevant request already wrote.
		resolveFalseRequest({ data: { data: [deviceFixture('false-device')] } });
		await olderFetch;

		expect(store.findAll().map((device) => device.name)).toEqual(['all-device']);
	});

	it('shares one in-flight request for two calls with the same hidden value', async () => {
		let resolveRequest!: (value: unknown) => void;

		const request = new Promise((resolve) => {
			resolveRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

		const first = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });
		const second = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(1);

		resolveRequest({ data: { data: [deviceFixture('device-1')] } });

		const [firstResult, secondResult] = await Promise.all([first, second]);

		expect(firstResult).toEqual(secondResult);
		expect(store.findAll().map((device) => device.name)).toEqual(['device-1']);
	});

	it('lands the correct data when a value is re-requested while its own earlier call is still pending (off → on → off)', async () => {
		let resolveFirstOffRequest!: (value: unknown) => void;
		let resolveOnRequest!: (value: unknown) => void;

		const firstOffRequest = new Promise((resolve) => {
			resolveFirstOffRequest = resolve;
		});
		const onRequest = new Promise((resolve) => {
			resolveOnRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(firstOffRequest).mockReturnValueOnce(onRequest);

		// Off: the mount fetch, hidden=false, still pending.
		const off1 = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });
		// On: the toggle flips — a distinct key, gets its own request.
		const on = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
		// Off again, before either of the above has returned: same key as `off1`, which is still
		// pending, so this takes the cache hit and shares its promise — it must NOT be silently
		// treated as satisfied by data that request eventually resolves with unless that request's
		// token has been re-armed to reflect this, more recent, "off" intent.
		const off2 = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });

		// Only two network calls: the repeated "off" coalesces onto the still-pending first one
		// rather than either being dropped or issuing a redundant third request.
		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);

		// The "on" request lands first — but by now the third call has already re-armed "off"'s
		// token, making "off" (not "on") the most recently requested value, so "on"'s response is
		// recognised as superseded the moment it arrives and is never written to the store at all
		// (stronger than merely being overwritten later: the UI never flashes the wrong device set).
		resolveOnRequest({ data: { data: [deviceFixture('all-device')] } });
		await on;

		expect(store.findAll()).toEqual([]);

		// The shared "off" request — re-armed by the third call — lands after, and correctly wins:
		// the user's final, most recent action was toggling back off, so the final store state must
		// match that, and both the original and coalescing callers must see the same result.
		resolveFirstOffRequest({ data: { data: [deviceFixture('false-device')] } });
		const [off1Result, off2Result] = await Promise.all([off1, off2]);

		expect(off1Result).toEqual(off2Result);
		expect(store.findAll().map((device) => device.name)).toEqual(['false-device']);
	});

	it('clears the fetching semaphore only once every overlapping fetch has settled', async () => {
		let resolveFalseRequest!: (value: unknown) => void;
		let resolveAllRequest!: (value: unknown) => void;

		const falseRequest = new Promise((resolve) => {
			resolveFalseRequest = resolve;
		});
		const allRequest = new Promise((resolve) => {
			resolveAllRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(falseRequest).mockReturnValueOnce(allRequest);

		const olderFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });
		const newerFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		expect(store.fetching()).toBe(true);

		resolveAllRequest({ data: { data: [] } });
		await newerFetch;

		// The older request is still in flight — the semaphore must not drop early.
		expect(store.fetching()).toBe(true);

		resolveFalseRequest({ data: { data: [] } });
		await olderFetch;

		expect(store.fetching()).toBe(false);
	});
});
