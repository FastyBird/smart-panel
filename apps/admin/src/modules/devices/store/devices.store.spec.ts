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

// Permissive: this spec exercises `fetch()`'s dedup/staleness handling and the bulk actions' own
// bookkeeping, not what ends up in the related controls/channels stores, so every key gets the same
// push-able, no-op stub. `findForDevice` answers empty because the cascade's fan-out is the channels
// store's concern; what matters here is that the cascade runs for the right devices.
const mockGetStore = vi.fn(() => ({
	firstLoad: [] as string[],
	set: vi.fn(),
	unset: vi.fn(),
	findForDevice: vi.fn(() => []),
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

	// A reconnect refresh must not narrow what the store holds. The endpoint reads an omitted filter as
	// "visible only", so a bare `fetch()` here would empty the device list's own "Show hidden" view and
	// drop a system-hidden source out of a mapping flow the operator has open.
	it('refreshes with every device, not just the visible ones', async () => {
		mockBackendClient.GET.mockResolvedValue({ data: { data: [] }, error: undefined, response: { status: 200 } });

		const store = useDevices();

		await store.refresh();

		expect(mockBackendClient.GET).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ params: { query: { hidden: DevicesModuleDevicesHiddenFilter.all } } })
		);
	});

	// The same reasoning one level down: `refresh()` asks explicitly, but every other unscoped caller —
	// socket-reconnect recovery, any `useDevices()` consumer — goes through `fetch()` with no payload,
	// and the answer *replaces* the shared cache. A consumer that wants only visible devices filters
	// what it reads; a cache missing rows cannot be filtered back into completeness.
	it('asks for every device when the caller names no filter', async () => {
		mockBackendClient.GET.mockResolvedValue({ data: { data: [] }, error: undefined, response: { status: 200 } });

		const store = useDevices();

		await store.fetch();

		expect(mockBackendClient.GET).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ params: { query: { hidden: DevicesModuleDevicesHiddenFilter.all } } })
		);
	});

	// And a caller that does name one still gets it — the default must not become an override.
	it('honours a caller that asks for the visible devices only', async () => {
		mockBackendClient.GET.mockResolvedValue({ data: { data: [] }, error: undefined, response: { status: 200 } });

		const store = useDevices();

		await store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });

		expect(mockBackendClient.GET).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ params: { query: { hidden: DevicesModuleDevicesHiddenFilter.false } } })
		);
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

	// The wizard hides a source device the moment a virtual device takes over. If the list fetch read
	// that row before the hide and DEVICE_UPDATED lands while the request is still in flight, applying
	// the response wholesale put the visible row back — the physical source rendered beside the virtual
	// device that replaced it, until something else happened to refresh the list.
	it('keeps a row written while a fetch was in flight, rather than restoring the snapshot it answers with', async () => {
		let resolveRequest!: (value: unknown) => void;

		const request = new Promise((resolve) => {
			resolveRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

		const source = deviceFixture('source-device');
		const pending = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		// The websocket event arrives before the response the server assembled before it.
		store.onEvent({ id: source.id, type: source.type, data: { ...source, hidden: true } });

		resolveRequest({ data: { data: [source] } });
		await pending;

		expect(store.findById(source.id)?.hidden).toBe(true);
	});

	// The other half of the same rule: a row the response *does* carry and nothing has touched since
	// the request went out is still applied, so this stays a replacement rather than a store that can
	// only ever be written by events.
	it('applies a row the response carries when nothing has written it since the request went out', async () => {
		let resolveRequest!: (value: unknown) => void;

		const request = new Promise((resolve) => {
			resolveRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

		const device = deviceFixture('untouched-device');
		const pending = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		resolveRequest({ data: { data: [{ ...device, hidden: true }] } });
		await pending;

		expect(store.findById(device.id)?.hidden).toBe(true);
	});

	// A device deleted while the fetch was in flight must stay deleted: the snapshot still carries it,
	// and restoring it would put a row the user has just removed back in the list.
	it('does not restore a device removed while a fetch was in flight', async () => {
		let resolveRequest!: (value: unknown) => void;

		const request = new Promise((resolve) => {
			resolveRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

		const doomed = deviceFixture('doomed-device');

		store.onEvent({ id: doomed.id, type: doomed.type, data: doomed });

		const pending = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		store.unset({ id: doomed.id });

		resolveRequest({ data: { data: [doomed] } });
		await pending;

		expect(store.findById(doomed.id)).toBeNull();
	});

	// Rows the response does not carry are still dropped — otherwise this would be a merge that can
	// only grow, and a device deleted on the backend would never leave the list.
	it('still evicts a row the response no longer carries', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValueOnce({ data: { data: [deviceFixture('kept-device')] } });

		const gone = deviceFixture('gone-device');

		store.onEvent({ id: gone.id, type: gone.type, data: gone });

		await store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

		expect(store.findById(gone.id)).toBeNull();
		expect(store.findAll().map((device) => device.name)).toEqual(['kept-device']);
	});

	// A superseded response may not write to the shared cache — that belongs to whichever scope was
	// requested last — but it is still a truthful answer to the question *this* caller asked. Handing
	// back the winning request's contents told a caller that asked for every device it had them when it
	// had only the visible ones; onboarding's plugin cleanup acts on exactly that difference.
	it('answers a superseded fetch from its own response, without writing it to the shared cache', async () => {
		let resolveAllRequest!: (value: unknown) => void;

		const allRequest = new Promise((resolve) => {
			resolveAllRequest = resolve;
		});

		(mockBackendClient.GET as Mock).mockReturnValueOnce(allRequest).mockResolvedValueOnce({ data: { data: [deviceFixture('visible-device')] } });

		const olderFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
		const newerFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.false });

		await newerFetch;

		const hidden = { ...deviceFixture('hidden-device'), hidden: true };

		resolveAllRequest({ data: { data: [hidden] } });

		const answered = await olderFetch;

		// The caller gets what it asked for …
		expect(answered.map((device) => device.name)).toEqual(['hidden-device']);
		// … and the cache still belongs to the request that won it.
		expect(store.findAll().map((device) => device.name)).toEqual(['visible-device']);
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

	// `edit()` merges the whole cached record into the object it validates, so schema defaults (e.g.
	// `roomId`'s `.default(null)`) resolve correctly even for a caller that only wants to change one
	// field. That merged-and-validated record must never leak into the outgoing PATCH body itself — a
	// key the caller did not supply has to stay off the wire, or an unrelated edit (e.g. a rename)
	// silently carries the device's current room along with it. These assert directly on the
	// `backendClient.PATCH` mock's call arguments — the actual request body — rather than on a mocked
	// store action, since asserting one layer up is exactly what let this regress unnoticed before.
	describe('edit() request body', () => {
		const seedDevice = async (roomId: string | null): Promise<IDeviceRes> => {
			const device = deviceFixture('device-1');
			device.room_id = roomId;

			(mockBackendClient.GET as Mock).mockResolvedValueOnce({ data: { data: [device] } });
			await store.fetch();

			return device;
		};

		it('omits room_id from the outgoing PATCH body when the caller does not supply it', async () => {
			const device = await seedDevice(uuid());

			(mockBackendClient.PATCH as Mock).mockResolvedValueOnce({ data: { data: { ...device, name: 'Renamed' } } });

			await store.edit({
				id: device.id,
				data: {
					type: device.type,
					name: 'Renamed',
				},
			});

			const [, requestInit] = (mockBackendClient.PATCH as Mock).mock.calls[0];

			expect('room_id' in requestInit.body.data).toBe(false);
		});

		it('sends a genuinely changed room_id on the outgoing PATCH body', async () => {
			const device = await seedDevice(uuid());
			const newRoomId = uuid();

			(mockBackendClient.PATCH as Mock).mockResolvedValueOnce({ data: { data: { ...device, room_id: newRoomId } } });

			await store.edit({
				id: device.id,
				data: {
					type: device.type,
					roomId: newRoomId,
				},
			});

			const [, requestInit] = (mockBackendClient.PATCH as Mock).mock.calls[0];

			expect(requestInit.body.data.room_id).toBe(newRoomId);
		});

		it('sends an explicit room_id: null on the outgoing PATCH body when the caller clears it', async () => {
			const device = await seedDevice(uuid());

			(mockBackendClient.PATCH as Mock).mockResolvedValueOnce({ data: { data: { ...device, room_id: null } } });

			await store.edit({
				id: device.id,
				data: {
					type: device.type,
					roomId: null,
				},
			});

			const [, requestInit] = (mockBackendClient.PATCH as Mock).mock.calls[0];

			expect(requestInit.body.data.room_id).toBe(null);
		});
	});

	describe('bulk actions', () => {
		const seed = async (count: number): Promise<string[]> => {
			const records = Array.from({ length: count }, (_, index) => deviceFixture(`Device ${index}`));

			mockBackendClient.GET.mockResolvedValue({
				data: { data: records },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

			return records.map((record) => record.id);
		};

		// The whole point of the endpoint: a selection is one request, not one per
		// device. Sending one each tripped the backend's 30-per-minute limit and
		// left the tail of a large selection unprocessed.
		it('removes a large selection with a single request', async () => {
			const ids = await seed(45);

			mockBackendClient.POST.mockResolvedValue({
				data: { data: { succeeded: ids, failed: [] } },
				error: undefined,
				response: { ok: true, status: 200 },
			});

			const result = await store.bulkRemove({ ids: [ids[0]!, ...ids.slice(1)] });

			expect(mockBackendClient.POST).toHaveBeenCalledTimes(1);
			expect(mockBackendClient.DELETE).not.toHaveBeenCalled();
			expect(result.succeeded).toHaveLength(45);
			expect(store.findAll()).toHaveLength(0);
		});

		it('keeps a device the backend refused', async () => {
			const ids = await seed(3);

			mockBackendClient.POST.mockResolvedValue({
				data: {
					data: {
						succeeded: [ids[0]!, ids[2]!],
						failed: [{ id: ids[1]!, reason: 'Device is hidden' }],
					},
				},
				error: undefined,
				response: { ok: true, status: 200 },
			});

			const result = await store.bulkRemove({ ids: [ids[0]!, ids[1]!, ids[2]!] });

			expect(result.failed).toEqual([{ id: ids[1], reason: 'Device is hidden' }]);
			expect(store.findAll().map((device) => device.id)).toEqual([ids[1]]);
		});

		it('sets the enabled state locally for the devices the backend confirmed', async () => {
			const ids = await seed(2);

			mockBackendClient.POST.mockResolvedValue({
				data: {
					data: { succeeded: [ids[0]!], failed: [{ id: ids[1]!, reason: 'Device could not be updated' }] },
				},
				error: undefined,
				response: { ok: true, status: 200 },
			});

			await store.bulkSetEnabled({ ids: [ids[0]!, ids[1]!], enabled: false });

			expect(mockBackendClient.POST).toHaveBeenCalledTimes(1);
			expect(store.findById(ids[0]!)?.enabled).toBe(false);
			// Untouched: the backend did not accept this one, so the row must keep
			// showing the state the backend still holds.
			expect(store.findById(ids[1]!)?.enabled).toBe(true);
		});

		// The race the mutation-token stamp exists to prevent: a `fetch()` already in flight when the
		// bulk update lands resolves afterwards with the response the server assembled before the
		// update - still carrying the pre-update `enabled` value. Applying that snapshot must not
		// undo the confirmed bulk outcome.
		it('keeps the bulk-confirmed value against a fetch that resolves later with the stale value', async () => {
			const device = deviceFixture('device-1');

			mockBackendClient.GET.mockResolvedValueOnce({ data: { data: [device] }, error: undefined, response: { status: 200 } });

			await store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

			let resolveRequest!: (value: unknown) => void;

			const request = new Promise((resolve) => {
				resolveRequest = resolve;
			});

			(mockBackendClient.GET as Mock).mockReturnValueOnce(request);

			// A refresh - e.g. on reconnect - starts before the bulk update goes out ...
			const pendingFetch = store.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });

			mockBackendClient.POST.mockResolvedValue({
				data: { data: { succeeded: [device.id], failed: [] } },
				error: undefined,
				response: { ok: true, status: 200 },
			});

			await store.bulkSetEnabled({ ids: [device.id], enabled: false });

			expect(store.findById(device.id)?.enabled).toBe(false);

			// ... and resolves only now, with the response the server built before the bulk update
			// committed - still `enabled: true`.
			resolveRequest({ data: { data: [device] } });
			await pendingFetch;

			expect(store.findById(device.id)?.enabled).toBe(false);
		});

		it('sends the selection in the request body', async () => {
			const ids = await seed(2);

			mockBackendClient.POST.mockResolvedValue({
				data: { data: { succeeded: ids, failed: [] } },
				error: undefined,
				response: { ok: true, status: 200 },
			});

			await store.bulkSetEnabled({ ids: [ids[0]!, ids[1]!], enabled: true });

			expect(mockBackendClient.POST).toHaveBeenCalledWith(
				expect.stringContaining('bulk-update'),
				expect.objectContaining({ body: { data: { ids, enabled: true } } })
			);
		});

		it('raises when the request itself fails', async () => {
			const ids = await seed(2);

			mockBackendClient.POST.mockResolvedValue({
				data: undefined,
				error: { detail: 'nope' },
				response: { ok: false, status: 500 },
			});

			await expect(store.bulkRemove({ ids: [ids[0]!, ids[1]!] })).rejects.toThrow();

			// Nothing was confirmed, so nothing may be dropped from the cache.
			expect(store.findAll()).toHaveLength(2);
		});
	});

});
