import { type EffectScope, effectScope, nextTick, reactive, ref } from 'vue';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceConnectionStatus } from '../../../openapi.constants';
import { devicesStoreKey } from '../../devices/store/keys';
import { LIVE_CONNECT_TIMEOUT_MS, LIVE_RETRY_DELAYS_MS, LIVE_SESSION_REQUEST_TIMEOUT_MS, LIVE_STABLE_AFTER_MS } from '../cameras.constants';
import type { MseClientEvent, MseClientOptions } from '../live/mse-client';
import { camerasStoreKey, relayStatusStoreKey } from '../store/keys';

import { type IUseLiveView, useLiveView } from './useLiveView';

const { postMock, mockLogger, FakeMseClient, clients, holder } = vi.hoisted(() => {
	const clients: { options: MseClientOptions; started: boolean; closed: boolean; emit: (event: MseClientEvent) => void }[] = [];

	class FakeMseClient {
		options: MseClientOptions;
		started = false;
		closed = false;

		constructor(options: MseClientOptions) {
			this.options = options;
			clients.push(this);
		}

		start(): void {
			this.started = true;
		}

		close(): void {
			this.closed = true;
		}

		emit(event: MseClientEvent): void {
			this.options.onEvent(event);
		}
	}

	return {
		postMock: vi.fn(),
		mockLogger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
		FakeMseClient,
		clients,
		holder: { stores: new Map<unknown, unknown>() },
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { POST: postMock } }),
		useLogger: () => mockLogger,
		logger: mockLogger,
		injectStoresManager: () => ({
			getStore: (key: unknown) => {
				if (!holder.stores.has(key)) {
					throw new Error(`Unexpected store key requested in test: ${String(key)}`);
				}

				return holder.stores.get(key);
			},
		}),
	};
});

vi.mock('../live/mse-client', async () => {
	const actual = await vi.importActual<typeof import('../live/mse-client')>('../live/mse-client');

	return { ...actual, MseClient: FakeMseClient };
});

type RelayState = 'running' | 'unavailable' | 'starting';

const relayStatusOf = (state: RelayState) => ({
	relay: { mode: 'managed', state, reason: state === 'running' ? null : 'process_exited', version: null },
	sessions: { active: 0, max: 8, maxPerCamera: 4 },
});

const profile = (id: string, videoCodec: string, available = true) => ({
	id,
	channelId: null,
	width: 1280,
	height: 720,
	fps: 25,
	videoCodec,
	audioCodec: null,
	available,
	unavailableReason: available ? null : 'offline',
});

const camera = (profiles = [profile('high', 'h264'), profile('hevc', 'h265')]) => ({
	deviceId: 'cam-1',
	name: 'Front door',
	category: 'camera',
	type: 'devices-unifi-protect',
	liveView: true,
	profiles,
});

const device = (status: DevicesModuleDeviceConnectionStatus, lastChanged: Date | null = null) => ({
	id: 'cam-1',
	status: { online: status === DevicesModuleDeviceConnectionStatus.connected, status, lastChanged },
});

const sessionOk = (token = 'SECRET') => ({
	data: { data: { session_id: 'sid', url: `/api/v1/modules/cameras/live?session=${token}`, expires_at: '2026-11-19T10:00:00Z' } },
	error: undefined,
	response: { status: 201 },
});

const failure = (status: number, error: unknown) => ({ data: undefined, error, response: { status } });

const notFound = (reason: string) => failure(404, { error: { message: 'Not Found', details: { reason } } });

const supportingCtor = (supported: string[]) =>
	({
		isTypeSupported: (type: string) => supported.some((codec) => type.includes(codec)),
	}) as unknown as typeof MediaSource;

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}

	await nextTick();
};

const lastClient = () => clients[clients.length - 1];

describe('useLiveView', () => {
	let camerasStore: { findById: Mock<(id: string) => ReturnType<typeof camera> | null>; get: Mock<() => Promise<ReturnType<typeof camera>>> };
	let relayStore: {
		status: ReturnType<typeof relayStatusOf> | null;
		get: Mock<() => Promise<ReturnType<typeof relayStatusOf>>>;
		startPolling: Mock<() => () => void>;
	};
	let devicesStore: { data: Record<string, ReturnType<typeof device>>; findById: (id: string) => unknown; get: Mock<() => Promise<undefined>> };
	let releasePolling: Mock<() => void>;
	let relayNext: RelayState;
	let scope: EffectScope | null;

	const mountLiveView = (options: Partial<Parameters<typeof useLiveView>[0]> = {}): IUseLiveView => {
		scope = effectScope();

		const video = ref<HTMLVideoElement | null>(document.createElement('video'));

		return scope.run(() => useLiveView({ deviceId: 'cam-1', profile: 'high', video, ...options }))!;
	};

	const unmount = (): void => {
		scope?.stop();
		scope = null;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		postMock.mockReset();
		clients.length = 0;
		Object.values(mockLogger).forEach((fn) => fn.mockClear());

		vi.stubGlobal('MediaSource', supportingCtor(['avc1', 'mp4a']));

		const cameraData = camera();

		camerasStore = {
			findById: vi.fn((id: string) => (id === 'cam-1' ? cameraData : null)),
			get: vi.fn(async () => cameraData),
		};

		relayNext = 'running';
		releasePolling = vi.fn();

		const relay = reactive({
			status: null as ReturnType<typeof relayStatusOf> | null,
			get: vi.fn(async () => {
				relay.status = relayStatusOf(relayNext);

				return relay.status;
			}),
			startPolling: vi.fn(() => releasePolling),
		});

		relayStore = relay;

		const devices = reactive({
			data: { 'cam-1': device(DevicesModuleDeviceConnectionStatus.connected) } as Record<string, ReturnType<typeof device>>,
			findById: (id: string) => devices.data[id] ?? null,
			get: vi.fn(async () => undefined),
		});

		devicesStore = devices;

		holder.stores.clear();
		holder.stores.set(camerasStoreKey, camerasStore);
		holder.stores.set(relayStatusStoreKey, relayStore);
		holder.stores.set(devicesStoreKey, devicesStore);

		scope = null;
	});

	afterEach(() => {
		unmount();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	const startPlaying = async (live: IUseLiveView): Promise<void> => {
		live.start();
		await flush();
		lastClient().emit({ type: 'media_started' });
		await flush();
	};

	it('reconnect creates a new session', async () => {
		postMock.mockResolvedValueOnce(sessionOk('one')).mockResolvedValueOnce(sessionOk('two'));

		const live = mountLiveView();
		await startPlaying(live);

		expect(live.state.value).toBe('playing');

		const first = lastClient();
		first.emit({ type: 'closed', code: 4002, reason: 'max_lifetime' });
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(first.closed).toBe(true);
		expect(clients).toHaveLength(2);
		expect(clients[1].options.url).toContain('session=two');
		expect(live.state.value).toBe('connecting');
	});

	it('exposes reconnect while a session is renewed after max_lifetime and clears it once media flows again', async () => {
		postMock.mockResolvedValueOnce(sessionOk('one')).mockResolvedValueOnce(sessionOk('two'));

		const live = mountLiveView();
		await startPlaying(live);

		expect(live.reconnect.value).toBe(false);

		lastClient().emit({ type: 'closed', code: 4002, reason: 'max_lifetime' });
		await flush();

		expect(live.state.value).toBe('connecting');
		expect(live.reconnect.value).toBe(true);

		lastClient().emit({ type: 'media_started' });
		await flush();

		expect(live.state.value).toBe('playing');
		expect(live.reconnect.value).toBe(false);
	});

	it('posts the session with the profile, the mse transport and an abort signal', async () => {
		postMock.mockResolvedValueOnce(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		const [path, init] = postMock.mock.calls[0];

		expect(path).toBe('/modules/cameras/cameras/{deviceId}/sessions');
		expect(init.params.path.deviceId).toBe('cam-1');
		expect(init.body).toEqual({ data: { profile: 'high', transport: 'mse' } });
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(lastClient().options.url).toBe('ws://localhost:3000/api/v1/modules/cameras/live?session=SECRET');
		expect(lastClient().started).toBe(true);
	});

	it.each<[RelayState, string]>([
		['unavailable', 'relay_unavailable'],
		['running', 'error'],
	])('classifies a 503 by the relay status: relay %s', async (relay, expected) => {
		relayNext = relay;
		postMock.mockResolvedValue(failure(503, { message: 'Relay is not available' }));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(relayStore.get).toHaveBeenCalled();
		expect(live.state.value).toBe(expected);

		if (expected === 'error') {
			// camera_unavailable is retryable
			expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
		}
	});

	it('retries once with the first available profile after Stream profile is not available', async () => {
		camerasStore.get.mockResolvedValue(camera([profile('high', 'h264', false), profile('low', 'h264')]));
		postMock.mockResolvedValueOnce(notFound('Stream profile is not available')).mockResolvedValueOnce(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		expect(camerasStore.get).toHaveBeenCalledWith({ deviceId: 'cam-1' });
		expect(postMock).toHaveBeenCalledTimes(2);
		expect(postMock.mock.calls[1][1].body.data.profile).toBe('low');
		expect(live.state.value).toBe('connecting');
	});

	it('ends in not_found when the fallback profile is not available either', async () => {
		camerasStore.get.mockResolvedValue(camera([profile('low', 'h264')]));
		postMock.mockResolvedValue(notFound('Stream profile is not available'));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBeNull();
	});

	it('treats a failed camera refetch during the profile fallback as a retryable failure', async () => {
		camerasStore.get.mockRejectedValue(new Error('network'));
		postMock.mockResolvedValue(notFound('Stream profile is not available'));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
	});

	it('maps a module disabled 404 to module_disabled', async () => {
		postMock.mockResolvedValue(notFound('Cameras module is disabled'));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('module_disabled');
	});

	it.each<[number, unknown]>([
		[404, { error: { message: 'Not Found', details: { reason: 'Camera not found' } } }],
		[403, { message: 'Forbidden' }],
	])('maps a %s to a final error', async (status, body) => {
		postMock.mockResolvedValue(failure(status, body));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBeNull();
	});

	it('leaves relay_unavailable when the polled relay becomes running', async () => {
		relayNext = 'unavailable';
		postMock.mockResolvedValueOnce(failure(503, { message: 'Relay is not available' })).mockResolvedValueOnce(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('relay_unavailable');
		expect(relayStore.startPolling).toHaveBeenCalledTimes(1);

		relayNext = 'running';
		await relayStore.get();
		await flush();

		expect(releasePolling).toHaveBeenCalled();
		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('connecting');

		// The relay staying up does not send another retry.
		await relayStore.get();
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
	});

	it('does not retry a relay refusal while the relay status never reported the relay down', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();
		lastClient().emit({ type: 'closed', code: 1013, reason: 'relay_unavailable' });
		await flush();

		expect(live.state.value).toBe('relay_unavailable');
		expect(relayStore.get).toHaveBeenCalled();

		await relayStore.get();
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('relay_unavailable');
	});

	it('holds relay polling while a session limit is reached and releases it on stop', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();
		lastClient().emit({ type: 'closed', code: 1013, reason: 'camera_session_limit' });
		await flush();

		expect(live.state.value).toBe('camera_limit');
		expect(relayStore.get).toHaveBeenCalledTimes(1);
		expect(relayStore.startPolling).toHaveBeenCalledTimes(1);
		expect(releasePolling).not.toHaveBeenCalled();

		live.stop();
		await flush();

		expect(live.state.value).toBe('snapshot');
		expect(releasePolling).toHaveBeenCalledTimes(1);
	});

	it('a socket that never delivers media fails after 15 s', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		const client = lastClient();
		expect(live.state.value).toBe('connecting');

		await vi.advanceTimersByTimeAsync(LIVE_CONNECT_TIMEOUT_MS - 1);
		expect(live.state.value).toBe('connecting');

		await vi.advanceTimersByTimeAsync(1);
		expect(client.closed).toBe(true);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
	});

	it('sends playing_stable after 10 s of playback and resets the retry budget', async () => {
		postMock.mockResolvedValueOnce(failure(500, { message: 'boom' })).mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);

		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0]);
		lastClient().emit({ type: 'media_started' });
		await flush();
		expect(live.state.value).toBe('playing');

		await vi.advanceTimersByTimeAsync(LIVE_STABLE_AFTER_MS);
		lastClient().emit({ type: 'closed', code: 1006, reason: '' });
		await flush();

		// The budget was reset by playing_stable, so this failure is the first again.
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
	});

	it('does not go offline while the device connection status is unknown', async () => {
		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.unknown);
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('connecting');
	});

	it('loads the device through the devices store when it is missing and stays online while unknown', async () => {
		delete devicesStore.data['cam-1'];
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		await flush();

		expect(devicesStore.get).toHaveBeenCalledWith({ id: 'cam-1' });

		live.start();
		await flush();

		expect(live.state.value).toBe('connecting');
	});

	it('retries with backoff and stops after five failures', async () => {
		postMock.mockResolvedValue(failure(500, { message: 'boom' }));

		const live = mountLiveView();
		live.start();
		await flush();

		for (const delay of LIVE_RETRY_DELAYS_MS) {
			expect(live.state.value).toBe('error');
			expect(live.retryInMs.value).toBe(delay);

			await vi.advanceTimersByTimeAsync(delay);
			await flush();
		}

		expect(postMock).toHaveBeenCalledTimes(6);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBeNull();

		await vi.advanceTimersByTimeAsync(60_000);
		expect(postMock).toHaveBeenCalledTimes(6);

		postMock.mockResolvedValue(sessionOk());
		live.retry();
		await flush();

		expect(postMock).toHaveBeenCalledTimes(7);
		expect(live.state.value).toBe('connecting');
	});

	it('unmount during requesting aborts the post and changes no state afterwards', async () => {
		let resolvePost!: (value: unknown) => void;
		let signal!: AbortSignal;

		postMock.mockImplementation((_path: string, init: { signal: AbortSignal }) => {
			signal = init.signal;

			return new Promise((resolve) => (resolvePost = resolve));
		});

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('requesting');

		unmount();

		expect(signal.aborted).toBe(true);

		resolvePost(sessionOk());
		await flush();

		expect(live.state.value).toBe('requesting');
		expect(clients).toHaveLength(0);
	});

	it('unmount while playing closes the client and clears the retry timer', async () => {
		postMock.mockResolvedValueOnce(failure(500, { message: 'boom' })).mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();
		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0]);
		lastClient().emit({ type: 'media_started' });
		await flush();

		expect(live.state.value).toBe('playing');

		const client = lastClient();
		unmount();

		expect(client.closed).toBe(true);
		expect(vi.getTimerCount()).toBe(0);

		client.emit({ type: 'closed', code: 1006, reason: '' });
		await vi.advanceTimersByTimeAsync(60_000);

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('playing');
	});

	it('cleans up relay polling on unmount', async () => {
		relayNext = 'unavailable';
		postMock.mockResolvedValue(failure(503, { message: 'Relay is not available' }));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('relay_unavailable');

		unmount();

		expect(releasePolling).toHaveBeenCalledTimes(1);
	});

	it('shows codec_unsupported for an h265 profile the browser cannot play without posting', async () => {
		const live = mountLiveView({ profile: 'hevc' });
		live.start();
		await flush();

		expect(live.state.value).toBe('codec_unsupported');
		expect(postMock).not.toHaveBeenCalled();
	});

	it('shows codec_unsupported without posting when the browser has no MediaSource', async () => {
		vi.stubGlobal('MediaSource', undefined);

		const live = mountLiveView();
		live.start();
		await flush();

		expect(live.state.value).toBe('codec_unsupported');
		expect(postMock).not.toHaveBeenCalled();
	});

	it('maps the client codec_unsupported and mime events', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		lastClient().emit({ type: 'mime', mime: 'video/mp4; codecs="avc1.640029"' });
		expect(live.mime.value).toBe('video/mp4; codecs="avc1.640029"');

		lastClient().emit({ type: 'codec_unsupported' });
		await flush();

		expect(live.state.value).toBe('codec_unsupported');
		expect(live.mime.value).toBeNull();
	});

	it('goes offline when the device goes offline and back to snapshot when it returns', async () => {
		const lastChanged = new Date('2026-11-19T09:00:00Z');
		let signal!: AbortSignal;

		postMock.mockImplementation((_path: string, init: { signal: AbortSignal }) => {
			signal = init.signal;

			return new Promise(() => undefined);
		});

		const live = mountLiveView();
		live.start();
		await flush();

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected, lastChanged);
		await flush();

		expect(live.state.value).toBe('offline');
		expect(signal.aborted).toBe(true);
		expect(live.lastSeen.value).toEqual(lastChanged);

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(live.state.value).toBe('snapshot');
	});

	it('closes a running client when the device goes offline', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		await startPlaying(live);

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.lost);
		await flush();

		expect(live.state.value).toBe('offline');
		expect(lastClient().closed).toBe(true);
	});

	it('stops and starts again when the profile changes while active', async () => {
		postMock.mockResolvedValue(sessionOk());

		const selected = ref<string | null>('high');
		const live = mountLiveView({ profile: selected });
		await startPlaying(live);

		const first = lastClient();
		selected.value = 'low';
		await flush();

		expect(first.closed).toBe(true);
		expect(postMock).toHaveBeenCalledTimes(2);
		expect(postMock.mock.calls[1][1].body.data.profile).toBe('low');
		expect(live.state.value).toBe('connecting');
	});

	it('fails a session request that does not settle in time as a retryable failure', async () => {
		let signal!: AbortSignal;

		postMock.mockImplementationOnce(
			(_path: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					signal = init.signal;
					signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				})
		);
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView();
		live.start();
		await flush();

		await vi.advanceTimersByTimeAsync(LIVE_SESSION_REQUEST_TIMEOUT_MS - 1);
		expect(live.state.value).toBe('requesting');
		expect(signal.aborted).toBe(false);

		await vi.advanceTimersByTimeAsync(1);
		expect(signal.aborted).toBe(true);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
		expect(mockLogger.warn).toHaveBeenCalledWith('Live view session request timed out.');

		// The aborted request reports nothing more, and the backoff retries as usual.
		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0]);
		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('connecting');
	});

	it('bounds the relay status read that classifies a 503', async () => {
		let resolveRelay!: (value: ReturnType<typeof relayStatusOf>) => void;

		postMock.mockResolvedValue(failure(503, { message: 'Relay is not available' }));
		relayStore.get.mockImplementationOnce(() => new Promise((resolve) => (resolveRelay = resolve)));

		const live = mountLiveView();
		live.start();
		await flush();

		expect(relayStore.get).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('requesting');

		await vi.advanceTimersByTimeAsync(LIVE_SESSION_REQUEST_TIMEOUT_MS);
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);

		// A read that settles after the deadline belongs to the expired attempt.
		resolveRelay(relayStatusOf('unavailable'));
		await flush();

		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
	});

	it('drops a relay failure that resolves while a profile change restarts the view', async () => {
		let resolveRelay!: (value: ReturnType<typeof relayStatusOf>) => void;

		postMock.mockResolvedValueOnce(failure(503, { message: 'Relay is not available' })).mockResolvedValue(sessionOk());
		relayStore.get.mockImplementationOnce(() => new Promise((resolve) => (resolveRelay = resolve)));

		const selected = ref<string | null>('high');
		const live = mountLiveView({ profile: selected });
		live.start();
		await flush();

		expect(live.state.value).toBe('requesting');

		// The classifier still owns the attempt when the read resolves; the profile watcher runs before its caller resumes.
		resolveRelay(relayStatusOf('unavailable'));
		selected.value = 'low';
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(postMock.mock.calls[1][1].body.data.profile).toBe('low');
		expect(live.state.value).toBe('connecting');
	});

	it('starts a fresh attempt with a fresh retry budget when the profile changes during a backoff', async () => {
		postMock.mockResolvedValue(failure(500, { message: 'boom' }));

		const selected = ref<string | null>('high');
		const live = mountLiveView({ profile: selected });
		live.start();
		await flush();

		// The backoff timer retries the same selection and keeps counting.
		for (const delay of LIVE_RETRY_DELAYS_MS.slice(0, -1)) {
			await vi.advanceTimersByTimeAsync(delay);
			await flush();
		}

		expect(postMock).toHaveBeenCalledTimes(LIVE_RETRY_DELAYS_MS.length);
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[LIVE_RETRY_DELAYS_MS.length - 1]);

		selected.value = 'low';
		await flush();

		expect(postMock).toHaveBeenCalledTimes(LIVE_RETRY_DELAYS_MS.length + 1);
		expect(postMock.mock.calls[LIVE_RETRY_DELAYS_MS.length][1].body.data.profile).toBe('low');
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);

		// The old backoff was cancelled: only the new one fires.
		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0]);
		await flush();

		expect(postMock).toHaveBeenCalledTimes(LIVE_RETRY_DELAYS_MS.length + 2);
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[1]);
	});

	it('restarts a newly selected profile after a terminal error with a fresh retry budget', async () => {
		postMock.mockResolvedValueOnce(failure(403, { message: 'Forbidden' })).mockResolvedValue(failure(500, { message: 'boom' }));

		const selected = ref<string | null>('high');
		const live = mountLiveView({ profile: selected });
		live.start();
		await flush();

		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBeNull();

		selected.value = 'low';
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(postMock.mock.calls[1][1].body.data.profile).toBe('low');
		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
	});

	it('restarts a newly selected profile after the codec of the old one was unsupported', async () => {
		postMock.mockResolvedValue(sessionOk());

		const selected = ref<string | null>('hevc');
		const live = mountLiveView({ profile: selected });
		live.start();
		await flush();

		expect(live.state.value).toBe('codec_unsupported');
		expect(postMock).not.toHaveBeenCalled();

		selected.value = 'high';
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(postMock.mock.calls[0][1].body.data.profile).toBe('high');
		expect(live.state.value).toBe('connecting');
	});

	it('restarts after the per camera session limit only when another camera is selected', async () => {
		postMock.mockResolvedValue(sessionOk());

		const deviceId = ref('cam-1');
		const selected = ref<string | null>('high');
		const live = mountLiveView({ deviceId, profile: selected });
		live.start();
		await flush();
		lastClient().emit({ type: 'closed', code: 1013, reason: 'camera_session_limit' });
		await flush();

		expect(live.state.value).toBe('camera_limit');

		selected.value = 'low';
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('camera_limit');

		deviceId.value = 'cam-2';
		selected.value = null;
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(postMock.mock.calls[1][1].params.path.deviceId).toBe('cam-2');
		expect(live.state.value).toBe('connecting');
	});

	it('only stops the old selection when the new one cannot stream', async () => {
		postMock.mockResolvedValue(sessionOk());

		const available = ref(true);
		const selected = ref<string | null>('high');
		const live = mountLiveView({ profile: selected, available });
		await startPlaying(live);

		available.value = false;
		selected.value = 'low';
		await flush();

		expect(lastClient().closed).toBe(true);
		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('snapshot');
	});

	it('starts an auto started view once a profile becomes available', async () => {
		postMock.mockResolvedValue(sessionOk());

		const available = ref(false);
		const live = mountLiveView({ autoStart: true, available });
		await flush();

		expect(postMock).not.toHaveBeenCalled();
		expect(live.state.value).toBe('snapshot');

		available.value = true;
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('connecting');
	});

	it('cancels a pending retry when the view stops being available and restarts once it is available again', async () => {
		postMock.mockResolvedValueOnce(failure(500, { message: 'boom' })).mockResolvedValue(sessionOk());

		const available = ref(true);
		const live = mountLiveView({ autoStart: true, profile: null, available });
		await flush();

		expect(live.state.value).toBe('error');
		expect(live.retryInMs.value).toBe(LIVE_RETRY_DELAYS_MS[0]);
		expect(postMock).toHaveBeenCalledTimes(1);

		available.value = false;
		await flush();
		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0] * 2);

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('snapshot');

		available.value = true;
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('connecting');
	});

	it('does not retry a failed request after the view stopped being available meanwhile', async () => {
		let resolvePost!: (value: unknown) => void;

		postMock.mockImplementationOnce(() => new Promise((resolve) => (resolvePost = resolve))).mockResolvedValue(sessionOk());

		const available = ref(true);
		const live = mountLiveView({ autoStart: true, profile: null, available });
		await flush();

		expect(live.state.value).toBe('requesting');

		available.value = false;
		await flush();

		resolvePost(failure(500, { message: 'boom' }));
		await flush();

		expect(live.state.value).toBe('error');

		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0] * 2);

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('snapshot');

		available.value = true;
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('connecting');
	});

	it('does not start an auto started view that was stopped before a profile became available', async () => {
		const available = ref(false);
		const live = mountLiveView({ autoStart: true, available });
		await flush();

		live.stop();
		available.value = true;
		await flush();

		expect(postMock).not.toHaveBeenCalled();
		expect(live.state.value).toBe('snapshot');
	});

	it('does not start a view that never asked to play when a profile becomes available', async () => {
		const available = ref(false);
		const live = mountLiveView({ available });
		await flush();

		available.value = true;
		await flush();

		expect(postMock).not.toHaveBeenCalled();
		expect(live.state.value).toBe('snapshot');
	});

	it('keeps the auto start intent of a view that comes back online before a profile is available', async () => {
		postMock.mockResolvedValue(sessionOk());
		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected);

		const available = ref(false);
		const live = mountLiveView({ autoStart: true, available });
		await flush();

		expect(live.state.value).toBe('offline');

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(postMock).not.toHaveBeenCalled();
		expect(live.state.value).toBe('snapshot');

		available.value = true;
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('connecting');
	});

	it('resumes an auto started view when the device comes back online', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView({ autoStart: true });
		await flush();
		lastClient().emit({ type: 'media_started' });
		await flush();

		expect(live.state.value).toBe('playing');

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected);
		await flush();

		expect(live.state.value).toBe('offline');

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(postMock).toHaveBeenCalledTimes(2);
		expect(live.state.value).toBe('connecting');
	});

	it('starts an auto started view that mounted offline once the device is online', async () => {
		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected);
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView({ autoStart: true });
		await flush();

		expect(live.state.value).toBe('offline');
		expect(postMock).not.toHaveBeenCalled();

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('connecting');
	});

	it.each<[string, (live: IUseLiveView) => void]>([
		['stopped before the device went offline', (live) => live.stop()],
		['stopped while the device was offline', () => undefined],
	])('does not resume a view that was %s', async (when, stopBefore) => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView({ autoStart: true });
		await flush();

		stopBefore(live);
		await flush();

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected);
		await flush();

		if (when === 'stopped while the device was offline') {
			live.stop();
			await flush();
		}

		expect(live.state.value).toBe('offline');

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('snapshot');
	});

	it('does not start a view that never asked to play when the device comes back online', async () => {
		const live = mountLiveView();
		await flush();

		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.disconnected);
		await flush();
		devicesStore.data['cam-1'] = device(DevicesModuleDeviceConnectionStatus.connected);
		await flush();

		expect(postMock).not.toHaveBeenCalled();
		expect(live.state.value).toBe('snapshot');
	});

	it('auto starts when asked', async () => {
		postMock.mockResolvedValue(sessionOk());

		const live = mountLiveView({ autoStart: true });
		await flush();

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(live.state.value).toBe('connecting');
	});

	it('the session url never reaches the logger', async () => {
		postMock
			.mockResolvedValueOnce(sessionOk())
			.mockResolvedValueOnce(sessionOk())
			.mockResolvedValue(failure(500, { message: 'boom' }));

		const live = mountLiveView();
		await startPlaying(live);

		lastClient().emit({ type: 'closed', code: 4002, reason: 'max_lifetime ?session=SECRET' });
		await flush();
		lastClient().emit({ type: 'closed', code: 1011, reason: 'proxy said ?session=SECRET' });
		await flush();
		await vi.advanceTimersByTimeAsync(LIVE_RETRY_DELAYS_MS[0]);

		const logged = Object.values(mockLogger).flatMap((fn) => fn.mock.calls.flat());

		expect(logged.length).toBeGreaterThan(0);

		for (const argument of logged) {
			expect(JSON.stringify(argument) ?? String(argument)).not.toContain('session=');
			expect(JSON.stringify(argument) ?? String(argument)).not.toContain('SECRET');
		}
	});
});
