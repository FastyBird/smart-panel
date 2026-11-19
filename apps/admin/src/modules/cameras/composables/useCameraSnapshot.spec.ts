import { defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
	let revoke: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		counter = 0;
		revoke = vi.fn();
		getMock.mockReset();
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:snap-${++counter}`), revokeObjectURL: revoke }));
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
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
});
