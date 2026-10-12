import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDevicesControls } from './devices.controls.store';

const client = { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() };
vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client }),
	useLogger: () => ({ error: vi.fn() }),
}));
const deviceId = uuid();
const id = uuid();
const raw = (name = 'Old') => ({ id, device: deviceId, name, created_at: '2024-03-01T12:00:00Z', updated_at: null });
const response = (data: unknown) => ({ data: { data }, response: { status: 200 } });
const failure = () => ({ error: {}, response: { status: 500 } });
const deferred = () => {
	let resolve!: (value: unknown) => void;
	const promise = new Promise<unknown>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('device control snapshot fences', () => {
	let store: ReturnType<typeof useDevicesControls>;
	beforeEach(() => {
		vi.resetAllMocks();
		setActivePinia(createPinia());
		store = useDevicesControls();
	});
	const read = (kind: string) => (kind === 'get' ? store.get({ id, deviceId }) : store.fetch({ deviceId }));
	const answer = (kind: string, name = 'Old') => response(kind === 'get' ? raw(name) : [raw(name)]);
	const event = (name = 'Socket') => store.onEvent({ id, data: raw(name) });

	it.each(['get', 'fetch'])('coalesces %s and clears bookkeeping after success', async (kind) => {
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const first = read(kind);
		const second = read(kind);
		expect(client.GET).toHaveBeenCalledTimes(1);
		expect(kind === 'get' ? store.getting(id) : store.fetching(deviceId)).toBe(true);
		pending.resolve(answer(kind));
		await Promise.all([first, second]);
		expect(store.findById(id)?.name).toBe('Old');
		expect(kind === 'get' ? store.getting(id) : store.fetching(deviceId)).toBe(false);
		expect(store.firstLoadFinished(deviceId)).toBe(kind === 'fetch');
	});

	it.each(['get', 'fetch'])('allows retry of failed %s', async (kind) => {
		client.GET.mockResolvedValueOnce(failure()).mockResolvedValueOnce(answer(kind));
		await expect(read(kind)).rejects.toThrow();
		expect(store.getting(id)).toBe(false);
		expect(store.fetching(deviceId)).toBe(false);
		expect(store.firstLoadFinished(deviceId)).toBe(false);
		await read(kind);
		expect(store.findById(id)).not.toBeNull();
	});

	for (const kind of ['get', 'fetch']) {
		it.each(['socket', 'row', 'scope'])(`${kind} preserves a newer %s mutation`, async (mutation) => {
			const pending = deferred();
			client.GET.mockReturnValue(pending.promise);
			const work = read(kind);
			if (mutation === 'socket') event();
			else if (mutation === 'row') store.unset({ id });
			else store.unset({ deviceId });
			pending.resolve(answer(kind));
			await work;
			expect(store.findById(id)?.name ?? null).toBe(mutation === 'socket' ? 'Socket' : null);
			expect(store.firstLoadFinished(deviceId)).toBe(kind === 'fetch');
		});
	}

	for (const olderKind of ['get', 'fetch']) {
		it.each(['older-first', 'newer-first'])(`a newer read wins over ${olderKind} in %s response order`, async (order) => {
			const newerKind = olderKind === 'get' ? 'fetch' : 'get';
			const older = deferred();
			const newer = deferred();
			client.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
			const oldRead = read(olderKind);
			const newRead = read(newerKind);
			if (order === 'older-first') {
				older.resolve(answer(olderKind));
				await oldRead;
			}
			newer.resolve(answer(newerKind, 'Newer'));
			await newRead;
			if (order === 'newer-first') {
				older.resolve(answer(olderKind));
				await oldRead;
			}
			expect(store.findById(id)?.name).toBe('Newer');
		});
	}

	for (const order of ['get-first', 'fetch-first']) {
		it.each(['socket', 'row', 'scope'])(`overlapping GET/fetch preserve %s in ${order} response order`, async (mutation) => {
			const getResponse = deferred();
			const fetchResponse = deferred();
			client.GET.mockReturnValueOnce(getResponse.promise).mockReturnValueOnce(fetchResponse.promise);
			const single = store.get({ id, deviceId });
			const collection = store.fetch({ deviceId });
			if (mutation === 'socket') event();
			else if (mutation === 'row') store.unset({ id });
			else store.unset({ deviceId });
			if (order === 'get-first') {
				getResponse.resolve(response(raw('GET')));
				await single;
			}
			fetchResponse.resolve(response([raw('Fetch')]));
			await collection;
			if (order === 'fetch-first') {
				getResponse.resolve(response(raw('GET')));
				await single;
			}
			expect(store.findById(id)?.name ?? null).toBe(mutation === 'socket' ? 'Socket' : null);
		});
	}

	it('supports draft creation, saving, and removal without extra API calls', async () => {
		await store.add({ id, deviceId, draft: true, data: { name: 'Draft' } });
		expect(store.findById(id)?.draft).toBe(true);
		expect(client.POST).not.toHaveBeenCalled();
		client.POST.mockResolvedValue(response(raw('Saved')));
		await store.save({ id, deviceId });
		expect(store.findById(id)).toMatchObject({ name: 'Saved', draft: false });
		client.DELETE.mockResolvedValue({ response: { status: 204 } });
		await store.remove({ id, deviceId });
		expect(store.findById(id)).toBeNull();
		await store.add({ id, deviceId, draft: true, data: { name: 'Draft' } });
		await store.remove({ id, deviceId });
		expect(client.DELETE).toHaveBeenCalledTimes(1);
		expect(store.semaphore.creating).toEqual([]);
		expect(store.semaphore.updating).toEqual([]);
		expect(store.semaphore.deleting).toEqual([]);
	});

	for (const kind of ['add', 'save']) {
		it.each(['socket', 'row', 'scope'])(`${kind} confirmation preserves a newer %s mutation`, async (mutation) => {
			if (kind === 'save') event('Draft');
			const pending = deferred();
			client.POST.mockReturnValue(pending.promise);
			const work = kind === 'add' ? store.add({ id, deviceId, draft: false, data: { name: 'Creating' } }) : store.save({ id, deviceId });
			if (mutation === 'socket') event();
			else if (mutation === 'row') store.unset({ id });
			else store.unset({ deviceId });
			pending.resolve(response(raw('Confirmation')));
			await work;
			expect(store.findById(id)?.name ?? null).toBe(mutation === 'socket' ? 'Socket' : null);
		});
	}

	it.each(['add', 'save', 'remove'])('fences older snapshots after a successful %s', async (kind) => {
		if (kind !== 'add') event('Existing');
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const oldRead = store.fetch({ deviceId });
		client.POST.mockResolvedValue(response(raw('Confirmed')));
		client.DELETE.mockResolvedValue({ response: { status: 204 } });
		if (kind === 'add') await store.add({ id, deviceId, draft: false, data: { name: 'Creating' } });
		else if (kind === 'save') await store.save({ id, deviceId });
		else await store.remove({ id, deviceId });
		pending.resolve(response([raw()]));
		await oldRead;
		expect(store.findById(id)?.name ?? null).toBe(kind === 'remove' ? null : 'Confirmed');
	});

	it('deduplicates firstLoad and keeps other device controls during scoped fetch', async () => {
		const otherId = uuid();
		const otherDeviceId = uuid();
		store.onEvent({ id: otherId, data: { ...raw('Other'), id: otherId, device: otherDeviceId } });
		client.GET.mockResolvedValue(response([raw()]));
		await store.fetch({ deviceId });
		await store.fetch({ deviceId });
		expect(store.firstLoad).toEqual([deviceId]);
		expect(store.findById(otherId)?.name).toBe('Other');
	});

	it('cleans up failed creation but preserves a socket update during failure', async () => {
		client.POST.mockResolvedValueOnce(failure());
		await expect(store.add({ id, deviceId, draft: false, data: { name: 'Creating' } })).rejects.toThrow();
		expect(store.findById(id)).toBeNull();
		const pending = deferred();
		client.POST.mockReturnValue(pending.promise);
		const work = store.add({ id, deviceId, draft: false, data: { name: 'Creating' } });
		const rejected = expect(work).rejects.toThrow();
		event();
		pending.resolve(failure());
		await rejected;
		expect(store.findById(id)?.name).toBe('Socket');
	});

	it('drains an older GET before restoring a failed deletion with a fresh GET', async () => {
		event();
		const older = deferred();
		client.GET.mockReturnValueOnce(older.promise).mockResolvedValueOnce(response(raw('Restored')));
		const oldRead = store.get({ id, deviceId });
		client.DELETE.mockResolvedValue(failure());
		const removing = expect(store.remove({ id, deviceId })).rejects.toThrow();
		await Promise.resolve();
		older.resolve(response(raw()));
		await oldRead;
		await removing;
		expect(client.GET).toHaveBeenCalledTimes(2);
		expect(store.findById(id)?.name).toBe('Restored');
		expect(store.semaphore.deleting).toEqual([]);
	});

	it.each(['socket', 'row', 'scope'])('failed deletion recovery preserves a newer %s', async (mutation) => {
		event();
		const pending = deferred();
		client.DELETE.mockReturnValue(pending.promise);
		const rejected = expect(store.remove({ id, deviceId })).rejects.toThrow();
		if (mutation === 'socket') event();
		else if (mutation === 'row') store.unset({ id });
		else store.unset({ deviceId });
		pending.resolve(failure());
		await rejected;
		expect(client.GET).not.toHaveBeenCalled();
		expect(store.findById(id)?.name ?? null).toBe(mutation === 'socket' ? 'Socket' : null);
	});
});
