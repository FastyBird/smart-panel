import { defineComponent, effectScope, h, nextTick, ref } from 'vue';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { type CameraSnapshotError, useCameraSnapshot } from './useCameraSnapshot';

const getMock = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: getMock } }),
	};
});

type Options = Parameters<typeof useCameraSnapshot>[1];

const blobResponse = (age?: string) => ({
	data: new Blob(['x'], { type: 'image/jpeg' }),
	response: { headers: new Headers(age !== undefined ? { 'X-Snapshot-Age': age } : {}) },
});

const errorResponse = (status: number, error: unknown, headers: Record<string, string> = {}) => ({
	error,
	response: { status, headers: new Headers(headers) },
});

const setVisibility = (state: 'visible' | 'hidden'): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
	document.dispatchEvent(new Event('visibilitychange'));
};

const mountHost = (deviceId: Parameters<typeof useCameraSnapshot>[0], options?: Options) => {
	let result!: ReturnType<typeof useCameraSnapshot>;

	const wrapper = mount(
		defineComponent({
			setup() {
				result = useCameraSnapshot(deviceId, options);

				return () => h('div');
			},
		})
	);

	return { wrapper, snapshot: result };
};

const flush = async (): Promise<void> => {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}

	await nextTick();
};

describe('useCameraSnapshot', () => {
	let counter: number;
	let revoke: Mock<(url: string) => void>;
	let createSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		counter = 0;
		revoke = vi.fn<(url: string) => void>();
		getMock.mockReset();
		createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:snap-${++counter}`);
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('revokes the previous object URL when a new snapshot replaces it', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		expect(snapshot.url.value).toBe('blob:snap-1');

		await snapshot.reload();

		expect(snapshot.url.value).toBe('blob:snap-2');
		expect(revoke).toHaveBeenCalledWith('blob:snap-1');
		wrapper.unmount();
	});

	it('revokes the object URL and aborts the request on unmount', async () => {
		getMock.mockResolvedValueOnce(blobResponse('1'));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		let signal!: AbortSignal;
		getMock.mockImplementationOnce((_path: string, opts: { signal: AbortSignal }) => {
			signal = opts.signal;

			return new Promise(() => undefined);
		});
		void snapshot.reload();
		await flush();
		wrapper.unmount();

		expect(revoke).toHaveBeenCalledWith('blob:snap-1');
		expect(signal.aborted).toBe(true);
	});

	it('reads the age from X-Snapshot-Age', async () => {
		getMock.mockResolvedValue(blobResponse('7'));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		expect(snapshot.ageSeconds.value).toBe(7);
		expect(snapshot.takenAt.value).toBeInstanceOf(Date);
		wrapper.unmount();
	});

	it('defaults the age to 0 when the header is absent', async () => {
		getMock.mockResolvedValue(blobResponse());

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		expect(snapshot.ageSeconds.value).toBe(0);
		wrapper.unmount();
	});

	it('maps a 503 Camera is offline to offline and keeps the last image', async () => {
		getMock.mockResolvedValueOnce(blobResponse('1'));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		getMock.mockResolvedValueOnce(errorResponse(503, { message: 'Camera is offline' }));
		await snapshot.reload();

		expect(snapshot.error.value).toBe('offline');
		expect(snapshot.url.value).toBe('blob:snap-1');
		expect(revoke).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it.each<[number, unknown, Record<string, string>, CameraSnapshotError]>([
		[503, { message: 'Camera is busy' }, {}, 'busy'],
		[503, { message: 'Something' }, { 'Retry-After': '3' }, 'busy'],
		[503, { message: 'Camera did not respond' }, {}, 'unavailable'],
		[404, { error: { message: 'Not Found', details: { reason: 'Camera not found' } } }, {}, 'not_found'],
		[500, { message: 'boom' }, {}, 'failed'],
	])('maps status %s to a typed error', async (status, body, headers, expected) => {
		getMock.mockResolvedValue(errorResponse(status, body, headers));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		expect(snapshot.error.value).toBe(expected);
		wrapper.unmount();
	});

	it('maps a 404 Cameras module is disabled to module_disabled', async () => {
		getMock.mockResolvedValue(errorResponse(404, { error: { message: 'Not Found', details: { reason: 'Cameras module is disabled' } } }));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();

		expect(snapshot.error.value).toBe('module_disabled');
		wrapper.unmount();
	});

	it('does not refresh while the page is hidden and reloads when it becomes visible', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const { wrapper } = mountHost('cam-1', { refreshMs: 1000 });
		await flush();
		expect(getMock).toHaveBeenCalledTimes(1);

		setVisibility('hidden');
		await vi.advanceTimersByTimeAsync(3500);
		expect(getMock).toHaveBeenCalledTimes(1);

		setVisibility('visible');
		await flush();
		expect(getMock).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('skips a timer tick while a request is running', async () => {
		getMock.mockImplementation(() => new Promise(() => undefined));

		const { wrapper } = mountHost('cam-1', { refreshMs: 1000 });
		await flush();
		await vi.advanceTimersByTimeAsync(3500);

		expect(getMock).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('aborts the running request when the profile changes and loads the new profile', async () => {
		const signals: AbortSignal[] = [];
		getMock.mockImplementation((_path: string, opts: { signal: AbortSignal }) => {
			signals.push(opts.signal);

			return signals.length === 1 ? new Promise(() => undefined) : Promise.resolve(blobResponse('1'));
		});

		const profile = ref<string | null>('main');
		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null, profile });
		await flush();

		profile.value = 'sub';
		await flush();

		expect(signals[0]?.aborted).toBe(true);
		expect(getMock).toHaveBeenCalledTimes(2);
		expect(getMock.mock.calls[1]?.[1].params.query.profile).toBe('sub');
		expect(snapshot.url.value).toBe('blob:snap-1');
		wrapper.unmount();
	});

	it('lets an explicit reload override hq for one request', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();
		await snapshot.reload({ hq: true });
		await snapshot.reload();

		expect(getMock.mock.calls.map((call) => call[1].params.query.hq)).toEqual(['false', 'true', 'false']);
		wrapper.unmount();
	});

	const abortable = (signalHolder: { signal?: AbortSignal }) => (_path: string, opts: { signal: AbortSignal }) => {
		signalHolder.signal = opts.signal;

		return new Promise((_resolve, reject) => {
			opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
		});
	};

	it('does not set an error or clear state when a hidden page aborts on a profile change', async () => {
		const holder: { signal?: AbortSignal } = {};
		getMock.mockImplementationOnce(abortable(holder));

		const profile = ref<string | null>('main');
		const { snapshot, wrapper } = mountHost('cam-1', { refreshMs: null, profile, active: ref(true) });
		await flush();

		setVisibility('hidden');
		profile.value = 'sub';
		await flush();

		expect(holder.signal?.aborted).toBe(true);
		expect(snapshot.error.value).toBeNull();
		expect(snapshot.loading.value).toBe(false);
		wrapper.unmount();
	});

	it('creates no object URL for a late resolve after abort or unmount', async () => {
		let resolveFirst!: (value: unknown) => void;
		getMock.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));

		const { wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();
		wrapper.unmount();

		resolveFirst(blobResponse('1'));
		await flush();

		expect(createSpy).not.toHaveBeenCalled();
	});

	it('discards a late resolve of an aborted request when the device changes', async () => {
		let resolveFirst!: (value: unknown) => void;
		getMock.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
		getMock.mockResolvedValueOnce(blobResponse('1'));

		const deviceId = ref('cam-1');
		const { snapshot, wrapper } = mountHost(deviceId, { refreshMs: null });
		await flush();

		deviceId.value = 'cam-2';
		await flush();
		resolveFirst(blobResponse('9'));
		await flush();

		expect(getMock.mock.calls[1]?.[1].params.path.deviceId).toBe('cam-2');
		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(snapshot.url.value).toBe('blob:snap-1');
		wrapper.unmount();
	});

	it('does not load while inactive and loads when it becomes active', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const active = ref(false);
		const { wrapper } = mountHost('cam-1', { refreshMs: 1000, active });
		await vi.advanceTimersByTimeAsync(3500);
		expect(getMock).not.toHaveBeenCalled();

		active.value = true;
		await flush();
		expect(getMock).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('removes the timer and the visibility listener on unmount', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const { wrapper } = mountHost('cam-1', { refreshMs: 1000 });
		await flush();
		wrapper.unmount();
		getMock.mockClear();

		await vi.advanceTimersByTimeAsync(3500);
		setVisibility('hidden');
		setVisibility('visible');
		await flush();

		expect(getMock).not.toHaveBeenCalled();
	});

	it('does not abort a request that is running when the page becomes visible', async () => {
		const holder: { signal?: AbortSignal } = {};
		getMock.mockImplementationOnce(abortable(holder));

		const { wrapper } = mountHost('cam-1', { refreshMs: null });
		await flush();
		setVisibility('visible');
		await flush();

		expect(holder.signal?.aborted).toBe(false);
		expect(getMock).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('cleans up inside an effect scope', async () => {
		getMock.mockResolvedValue(blobResponse('1'));

		const scope = effectScope();
		const snapshot = scope.run(() => useCameraSnapshot('cam-1', { refreshMs: null }))!;
		await flush();
		scope.stop();

		expect(revoke).toHaveBeenCalledWith('blob:snap-1');
		void snapshot;
	});
});
