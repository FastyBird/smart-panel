import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { CamerasApiException } from '../cameras.exceptions';

import { useCameras } from './cameras.store';

const { mockBackendClient, mockLogger } = vi.hoisted(() => ({
	mockBackendClient: { GET: vi.fn() },
	mockLogger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
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
		useBackend: vi.fn(() => ({ client: mockBackendClient })),
		useLogger: vi.fn(() => mockLogger),
		logger: mockLogger,
	};
});

const cameraRes = (id: string, name: string) => ({
	device_id: id,
	name,
	category: 'camera',
	type: 'devices-unifi-protect',
	live_view: true,
	profiles: [
		{
			id: 'high',
			channel_id: null,
			width: 1280,
			height: 720,
			fps: 25,
			video_codec: 'h264',
			audio_codec: null,
			available: true,
			unavailable_reason: null,
		},
	],
});

const ok = (data: unknown) => ({ data: { data }, error: undefined, response: { status: 200 } });

describe('Cameras store', () => {
	let store: ReturnType<typeof useCameras>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();

		store = useCameras();
	});

	it('fetch stores every camera and drops cameras missing from the next fetch', async () => {
		(mockBackendClient.GET as Mock)
			.mockResolvedValueOnce(ok([cameraRes('a', 'Zeta'), cameraRes('b', 'Alpha')]))
			.mockResolvedValueOnce(ok([cameraRes('a', 'Zeta')]));

		await store.fetch();

		expect(store.findAll().map((c) => c.deviceId)).toEqual(['b', 'a']);
		expect(store.findAll()[0].profiles[0].channelId).toBeNull();
		expect(store.isLoaded()).toBe(true);

		await store.fetch();

		expect(store.findById('b')).toBeNull();
		expect(store.findAll().map((c) => c.deviceId)).toEqual(['a']);
	});

	it('get updates one camera', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue(ok(cameraRes('a', 'Front door')));

		const camera = await store.get({ deviceId: 'a' });

		expect(camera.name).toBe('Front door');
		expect(store.findById('a')?.liveView).toBe(true);
		expect(store.semaphore.getting).toEqual([]);
	});

	it('get throws CamerasApiException with the response status on 404', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: { error: { message: 'Camera not found' } },
			response: { status: 404 },
		});

		await expect(store.get({ deviceId: 'x' })).rejects.toMatchObject({
			name: 'CamerasApiException',
			code: 404,
			message: 'Camera not found',
		});
		await expect(store.get({ deviceId: 'x' })).rejects.toBeInstanceOf(CamerasApiException);
	});

	const LIST_PATH = '/modules/cameras/cameras';
	const DETAIL_PATH = '/modules/cameras/cameras/{deviceId}';

	const notFound = { data: undefined, error: { error: { message: 'Camera not found' } }, response: { status: 404 } };

	it('does not let a detail response that started before a completed list restore a camera the list removed', async () => {
		let resolveDetail!: (value: unknown) => void;

		(mockBackendClient.GET as Mock)
			.mockResolvedValueOnce(ok([cameraRes('a', 'Alpha'), cameraRes('b', 'Bravo')]))
			.mockImplementationOnce(() => new Promise((resolve) => (resolveDetail = resolve)))
			.mockResolvedValueOnce(ok([cameraRes('a', 'Alpha')]));

		await store.fetch();

		const detail = store.get({ deviceId: 'b' });

		await store.fetch();

		resolveDetail(ok(cameraRes('b', 'Bravo')));

		expect((await detail).deviceId).toBe('b');
		expect(store.findById('b')).toBeNull();
		expect(store.findAll().map((c) => c.deviceId)).toEqual(['a']);

		// A detail read that starts after the list is cached as usual.
		(mockBackendClient.GET as Mock).mockResolvedValueOnce(ok(cameraRes('b', 'Bravo')));

		await store.get({ deviceId: 'b' });

		expect(store.findById('b')?.name).toBe('Bravo');
	});

	it('counts a camera held only through get as loaded and refreshes it by reading it again', async () => {
		expect(store.isLoaded()).toBe(false);

		(mockBackendClient.GET as Mock).mockResolvedValueOnce(ok(cameraRes('h', 'Hidden porch')));

		await store.get({ deviceId: 'h' });

		expect(store.isLoaded()).toBe(true);

		(mockBackendClient.GET as Mock).mockResolvedValueOnce(ok(cameraRes('h', 'Porch')));

		await store.refresh();

		const [path, init] = (mockBackendClient.GET as Mock).mock.calls[1];

		expect(mockBackendClient.GET).toHaveBeenCalledTimes(2);
		expect(path).toBe(DETAIL_PATH);
		expect(init.params.path.deviceId).toBe('h');
		expect(store.findById('h')?.name).toBe('Porch');
	});

	it('refreshes the list, then a camera held through get that the list leaves out, keeping it off the list', async () => {
		(mockBackendClient.GET as Mock)
			.mockResolvedValueOnce(ok([cameraRes('a', 'Alpha')]))
			.mockResolvedValueOnce(ok(cameraRes('h', 'Hidden porch')))
			.mockResolvedValueOnce(ok([cameraRes('a', 'Alpha')]))
			.mockResolvedValueOnce(ok(cameraRes('h', 'Porch')));

		await store.fetch();
		await store.get({ deviceId: 'h' });

		expect(store.findAll().map((c) => c.deviceId)).toEqual(['a']);

		await store.refresh();

		expect((mockBackendClient.GET as Mock).mock.calls.map(([path]) => path)).toEqual([LIST_PATH, DETAIL_PATH, LIST_PATH, DETAIL_PATH]);
		expect(store.findById('h')?.name).toBe('Porch');
		expect(store.findAll().map((c) => c.deviceId)).toEqual(['a']);
	});

	it('drops a camera held through get that is gone when it is refreshed', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValueOnce(ok(cameraRes('h', 'Porch'))).mockResolvedValueOnce(notFound);

		await store.get({ deviceId: 'h' });
		await store.refresh();

		expect(store.findById('h')).toBeNull();
		expect(store.isLoaded()).toBe(false);
	});
});
