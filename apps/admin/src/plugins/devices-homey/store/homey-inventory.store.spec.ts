import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_HOMEY_ADOPTION_BATCH_SIZE } from '../devices-homey.constants';

import { useHomeyInventory } from './homey-inventory.store';

const post = vi.fn();
const get = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get, POST: post } }),
		getErrorReason: () => 'Homey adoption failed',
	};
});

const adoptionResponse = (deviceIds: string[]) => ({
	data: {
		data: {
			results: deviceIds.map((deviceId) => ({
				device_id: deviceId,
				status: 'created',
				panel_device_id: '4a2515a6-7e87-4e51-96cc-832698237613',
				failure_code: null,
				message: null,
			})),
		},
	},
	response: { status: 200 },
});

describe('Homey inventory store batch adoption', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('splits large selections into backend-sized requests and preserves result order', async () => {
		const selections = Array.from({ length: MAX_HOMEY_ADOPTION_BATCH_SIZE + 18 }, (_, index) => ({
			deviceId: `homey-device-${index}`,
		}));
		post
			.mockResolvedValueOnce(adoptionResponse(selections.slice(0, MAX_HOMEY_ADOPTION_BATCH_SIZE).map(({ deviceId }) => deviceId)))
			.mockResolvedValueOnce(adoptionResponse(selections.slice(MAX_HOMEY_ADOPTION_BATCH_SIZE).map(({ deviceId }) => deviceId)));
		const store = useHomeyInventory();

		const results = await store.adoptBatch(selections);

		expect(post).toHaveBeenCalledTimes(2);
		expect(post.mock.calls.map(([, request]) => request.body.devices)).toHaveLength(2);
		expect(post.mock.calls[0]?.[1].body.devices).toHaveLength(MAX_HOMEY_ADOPTION_BATCH_SIZE);
		expect(post.mock.calls[1]?.[1].body.devices).toHaveLength(18);
		expect(results.map(({ deviceId }) => deviceId)).toEqual(selections.map(({ deviceId }) => deviceId));
		expect(store.adoptionResults).toEqual(results);
	});

	it('retains completed per-device results when a later chunk fails', async () => {
		const selections = Array.from({ length: MAX_HOMEY_ADOPTION_BATCH_SIZE + 1 }, (_, index) => ({
			deviceId: `homey-device-${index}`,
		}));
		post
			.mockResolvedValueOnce(adoptionResponse(selections.slice(0, MAX_HOMEY_ADOPTION_BATCH_SIZE).map(({ deviceId }) => deviceId)))
			.mockResolvedValueOnce({ error: new Error('Homey is offline'), response: { status: 503 } });
		const store = useHomeyInventory();

		await expect(store.adoptBatch(selections)).rejects.toThrow('Homey adoption failed');

		expect(store.adoptionResults).toHaveLength(MAX_HOMEY_ADOPTION_BATCH_SIZE);
		expect(store.adoptionResults.map(({ deviceId }) => deviceId)).toEqual(
			selections.slice(0, MAX_HOMEY_ADOPTION_BATCH_SIZE).map(({ deviceId }) => deviceId)
		);
		expect(store.adopting).toBe(false);
	});

	it('invalidates mapping previews when refreshed inventory replaces the cache', async () => {
		get.mockResolvedValue({ data: { data: [] }, response: { status: 200 } });
		const store = useHomeyInventory();
		store.previews['homey-light'] = {
			suggestedCategory: null,
			selectedCategory: null,
			validCategories: [],
			channels: [],
			unsupportedCapabilityIds: [],
			warnings: [],
			readyToAdopt: false,
			device: {
				id: 'homey-light',
				name: 'Desk light',
				class: 'light',
				zonePath: [],
				available: true,
			},
		};

		await store.fetch();

		expect(store.previews).toEqual({});
	});

	it('does not publish inventory after its request is aborted', async () => {
		const abortController = new AbortController();
		get.mockImplementation(async (_path: string, request: { signal?: AbortSignal }) => {
			expect(request.signal).toBe(abortController.signal);
			abortController.abort();

			return { data: { data: [] }, response: { status: 200 } };
		});
		const store = useHomeyInventory();

		await expect(store.fetch({}, abortController.signal)).rejects.toBe(abortController.signal.reason);

		expect(store.firstLoad).toBe(false);
		expect(store.fetching).toBe(false);
	});

	it('does not publish a mapping preview after its request is aborted', async () => {
		const abortController = new AbortController();
		post.mockImplementation(async (_path: string, request: { signal?: AbortSignal }) => {
			expect(request.signal).toBe(abortController.signal);
			abortController.abort();

			return { data: {}, response: { status: 200 } };
		});
		const store = useHomeyInventory();

		await expect(store.preview('homey-light', undefined, abortController.signal)).rejects.toBe(abortController.signal.reason);

		expect(store.previews).toEqual({});
		expect(store.previewing).toEqual([]);
	});

	it('does not publish adoption results after its request is aborted', async () => {
		const abortController = new AbortController();
		post.mockImplementation(async (_path: string, request: { signal?: AbortSignal }) => {
			expect(request.signal).toBe(abortController.signal);
			abortController.abort();

			return adoptionResponse(['homey-light']);
		});
		const store = useHomeyInventory();

		await expect(store.adoptBatch([{ deviceId: 'homey-light' }], abortController.signal)).rejects.toBe(abortController.signal.reason);

		expect(store.adoptionResults).toEqual([]);
		expect(store.adopting).toBe(false);
	});
});
