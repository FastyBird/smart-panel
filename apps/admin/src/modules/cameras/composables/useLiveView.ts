import { type ComputedRef, type MaybeRefOrGetter, type Ref, computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend, useLogger } from '../../../common';
import { CamerasModuleCreateSessionTransport, CamerasModuleDataRelayStatusState } from '../../../openapi.constants';
import { devicesStoreKey } from '../../devices/store/keys';
import { CAMERAS_MODULE_PREFIX, LIVE_CONNECT_TIMEOUT_MS, LIVE_SESSION_REQUEST_TIMEOUT_MS, LIVE_STABLE_AFTER_MS } from '../cameras.constants';
import { buildLiveSocketUrl, isDeviceOffline, isModuleDisabledError, readErrorMessage } from '../cameras.utils';
import { canPlayProfileCodec, getMediaSourceCtor } from '../live/codecs';
import {
	type LiveViewContext,
	type LiveViewEvent,
	type LiveViewState,
	type SessionFailure,
	initialContext,
	transition,
} from '../live/live-view-machine';
import { MSE_CLIENT_CLOSE, MseClient, type MseClientEvent } from '../live/mse-client';
import type { ICameraProfile } from '../store';
import { camerasStoreKey, relayStatusStoreKey } from '../store/keys';

export interface IUseLiveViewOptions {
	deviceId: MaybeRefOrGetter<string>;
	/** The stream profile to open; `null` lets the backend pick the first available one. */
	profile: MaybeRefOrGetter<string | null>;
	video: Ref<HTMLVideoElement | null>;
	autoStart?: boolean;
}

export interface IUseLiveView {
	state: Readonly<Ref<LiveViewState>>;
	retryInMs: Readonly<Ref<number | null>>;
	/** A seamless session renewal is running: the view shows the snapshot underneath, without the connecting overlay. */
	reconnect: ComputedRef<boolean>;
	mime: Readonly<Ref<string | null>>;
	lastSeen: ComputedRef<Date | null>;
	start: () => void;
	stop: () => void;
	retry: () => void;
}

const PROFILE_NOT_AVAILABLE_MESSAGE = 'Stream profile is not available';

/** The camera could not be read again during the profile fallback; a profile id can never collide with it. */
const REFETCH_FAILED = Symbol('refetch-failed');

/** States that own a session request or a running client. */
const ACTIVE_STATES: ReadonlySet<LiveViewState> = new Set<LiveViewState>(['requesting', 'connecting', 'playing']);

/** States that wait for the relay or for a free session slot, polling the relay status meanwhile. */
const RELAY_WAIT_STATES: ReadonlySet<LiveViewState> = new Set<LiveViewState>(['relay_unavailable', 'camera_limit', 'total_limit']);

/**
 * Drives one camera live view: creates a session, plays it through `MseClient`, and feeds every outcome into the live
 * view state machine, which decides what comes next. The session URL carries a single-use token, so it goes only to the
 * client and never to a log line, a ref or an error.
 */
export const useLiveView = (options: IUseLiveViewOptions): IUseLiveView => {
	const backend = useBackend();
	const logger = useLogger();
	const storesManager = injectStoresManager();

	const camerasStore = storesManager.getStore(camerasStoreKey);
	const relayStatusStore = storesManager.getStore(relayStatusStoreKey);
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const context = shallowRef<LiveViewContext>(initialContext());
	const mime = ref<string | null>(null);

	const device = computed(() => devicesStore.findById(toValue(options.deviceId)));

	let disposed = false;
	let dispatching = false;
	const queue: LiveViewEvent[] = [];

	/** Increased for every session attempt; a callback of an older attempt changes nothing. */
	let attemptId = 0;
	let requestController: AbortController | null = null;
	let client: MseClient | null = null;

	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let stableTimer: ReturnType<typeof setTimeout> | null = null;
	let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
	let requestTimer: ReturnType<typeof setTimeout> | null = null;

	let releasePolling: (() => void) | null = null;
	/** Set once the relay was seen down while waiting in `relay_unavailable`, so only a change to `running` retries. */
	let relaySeenDown = false;

	/**
	 * An auto started view keeps wanting to play until it is stopped: a device that comes back online resumes it, and
	 * `start` or `retry` after a `stop` wants it again. A view started by hand only stays on the snapshot.
	 */
	const autoPlay = options.autoStart === true;
	let wantsPlayback = autoPlay;

	const send = (event: LiveViewEvent): void => {
		if (disposed) {
			return;
		}

		// Effects may send further events (a client can report synchronously); they run after the current one.
		queue.push(event);

		if (dispatching) {
			return;
		}

		dispatching = true;

		try {
			while (queue.length > 0 && !disposed) {
				const previous = context.value;
				const next = transition(previous, queue.shift()!);

				if (next !== previous) {
					context.value = next;
					applyEffects(previous, next);
				}
			}
		} finally {
			queue.length = 0;
			dispatching = false;
		}
	};

	const clearTimers = (): void => {
		for (const timer of [retryTimer, stableTimer, watchdogTimer, requestTimer]) {
			if (timer !== null) {
				clearTimeout(timer);
			}
		}

		retryTimer = null;
		stableTimer = null;
		watchdogTimer = null;
		requestTimer = null;
	};

	const teardownSession = (): void => {
		attemptId++;
		requestController?.abort();
		requestController = null;
		client?.close();
		client = null;
		mime.value = null;
	};

	const holdRelayPolling = (): void => {
		relayStatusStore.get().catch((): void => {
			logger.warn('Failed to read the relay status for the live view.');
		});

		if (releasePolling === null) {
			releasePolling = relayStatusStore.startPolling();
		}
	};

	const releaseRelayPolling = (): void => {
		releasePolling?.();
		releasePolling = null;
	};

	const findProfile = (deviceId: string, profileId: string | null): ICameraProfile | null => {
		const camera = camerasStore.findById(deviceId);

		if (camera === null) {
			return null;
		}

		return profileId === null
			? (camera.profiles.find((profile) => profile.available) ?? null)
			: (camera.profiles.find((profile) => profile.id === profileId) ?? null);
	};

	/** `false` when the browser cannot play the profile, so no session is spent on it. */
	const canPlay = (deviceId: string, profileId: string | null): boolean => {
		const ctor = getMediaSourceCtor();

		if (ctor === null) {
			return false;
		}

		const profile = findProfile(deviceId, profileId);

		return profile === null || canPlayProfileCodec(profile.videoCodec, ctor);
	};

	const onClientEvent = (owner: MseClient, event: MseClientEvent): void => {
		if (owner !== client || disposed) {
			return;
		}

		switch (event.type) {
			case 'mime':
				mime.value = event.mime;
				break;
			case 'media_started':
				send({ type: 'media_started' });
				break;
			case 'codec_unsupported':
				send({ type: 'codec_unsupported' });
				break;
			case 'closed':
				// The reason is free text a proxy could fill; only the code is logged.
				logger.info('Live view socket closed.', { code: event.code });
				send({ type: 'socket_closed', code: event.code, reason: event.reason });
				break;
		}
	};

	const startClient = (sessionUrl: string): void => {
		const video = options.video.value;
		const ctor = getMediaSourceCtor();

		let url: string;

		try {
			url = buildLiveSocketUrl(sessionUrl, window.location);
		} catch {
			logger.warn('Live view session URL was rejected.');
			send({ type: 'socket_closed', code: MSE_CLIENT_CLOSE.CONNECT_FAILED[0], reason: MSE_CLIENT_CLOSE.CONNECT_FAILED[1] });

			return;
		}

		if (video === null || ctor === null) {
			logger.warn('Live view has no video element to play into.');
			send({ type: 'socket_closed', code: MSE_CLIENT_CLOSE.MEDIA_ERROR[0], reason: MSE_CLIENT_CLOSE.MEDIA_ERROR[1] });

			return;
		}

		const created: MseClient = new MseClient({
			url,
			video,
			mediaSource: ctor,
			onEvent: (event) => onClientEvent(created, event),
		});

		client = created;
		created.start();
	};

	const classifyRelayFailure = async (id: number): Promise<SessionFailure | null> => {
		try {
			const status = await relayStatusStore.get();

			if (id !== attemptId || disposed) {
				return null;
			}

			return status.relay.state === CamerasModuleDataRelayStatusState.running ? 'camera_unavailable' : 'relay_unavailable';
		} catch {
			if (id === attemptId && !disposed) {
				logger.warn('Failed to read the relay status for the live view.');
			}

			return id === attemptId && !disposed ? 'failed' : null;
		}
	};

	/**
	 * The first available profile of a freshly read camera, `null` when the camera has none, or `REFETCH_FAILED` when it
	 * could not be read, which is retryable.
	 */
	const refetchFallbackProfile = async (deviceId: string): Promise<string | null | typeof REFETCH_FAILED> => {
		try {
			const camera = await camerasStore.get({ deviceId });

			return camera.profiles.find((profile) => profile.available)?.id ?? null;
		} catch {
			logger.warn('Failed to reload the camera profiles for the live view.');

			return REFETCH_FAILED;
		}
	};

	const requestSession = async (id: number, deviceId: string, profileId: string | null, fallbackUsed: boolean): Promise<void> => {
		const controller = new AbortController();

		requestController = controller;

		let result: { data?: { data: { url: string } }; error?: unknown; response?: Response };

		try {
			result = (await backend.client.POST(`/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/cameras/{deviceId}/sessions`, {
				params: { path: { deviceId } },
				body: {
					data: {
						...(profileId !== null ? { profile: profileId } : {}),
						transport: CamerasModuleCreateSessionTransport.mse,
					},
				},
				signal: controller.signal,
			})) as typeof result;
		} catch {
			if (id === attemptId && !disposed) {
				logger.warn('Live view session request failed.');
				send({ type: 'session_failed', failure: 'failed' });
			}

			return;
		}

		if (id !== attemptId || disposed) {
			return;
		}

		requestController = null;

		if (result.data !== undefined) {
			send({ type: 'session_created' });

			if (id === attemptId && context.value.state === 'connecting') {
				startClient(result.data.data.url);
			}

			return;
		}

		const status = result.response?.status ?? 0;

		logger.warn('Live view session request was refused.', { status });

		if (status === 503) {
			const failure = await classifyRelayFailure(id);

			// The classifier checked ownership before it returned, but a profile change can restart the view before this
			// continuation runs; its failure must not reach the new attempt.
			if (failure !== null && id === attemptId && !disposed) {
				send({ type: 'session_failed', failure });
			}

			return;
		}

		if (status === 404) {
			if (isModuleDisabledError(status, result.error)) {
				send({ type: 'session_failed', failure: 'module_disabled' });

				return;
			}

			if (readErrorMessage(result.error) === PROFILE_NOT_AVAILABLE_MESSAGE && !fallbackUsed) {
				const fallback = await refetchFallbackProfile(deviceId);

				if (id !== attemptId || disposed) {
					return;
				}

				if (fallback === null || fallback === REFETCH_FAILED) {
					send({ type: 'session_failed', failure: fallback === REFETCH_FAILED ? 'failed' : 'not_found' });

					return;
				}

				if (!canPlay(deviceId, fallback)) {
					send({ type: 'codec_unsupported' });

					return;
				}

				await requestSession(id, deviceId, fallback, true);

				return;
			}

			send({ type: 'session_failed', failure: 'not_found' });

			return;
		}

		send({ type: 'session_failed', failure: status === 403 ? 'forbidden' : 'failed' });
	};

	const beginSession = (): void => {
		const deviceId = toValue(options.deviceId);
		const profileId = toValue(options.profile);

		if (!canPlay(deviceId, profileId)) {
			send({ type: 'codec_unsupported' });

			return;
		}

		void requestSession(attemptId, deviceId, profileId, false);
	};

	function applyEffects(previous: LiveViewContext, next: LiveViewContext): void {
		clearTimers();

		if (next.state === 'requesting') {
			teardownSession();
			beginSession();
		} else if (!ACTIVE_STATES.has(next.state)) {
			teardownSession();
		}

		if (next.state === 'requesting') {
			// Bounds the whole request: the session POST, and the relay status read or profile fallback it may need.
			requestTimer = setTimeout(() => {
				requestTimer = null;
				logger.warn('Live view session request timed out.');
				requestController?.abort();
				send({ type: 'session_failed', failure: 'failed' });
			}, LIVE_SESSION_REQUEST_TIMEOUT_MS);
		}

		if (next.state === 'connecting') {
			watchdogTimer = setTimeout(() => {
				watchdogTimer = null;
				logger.warn('Live view did not receive media in time.');
				client?.close();
				send({ type: 'socket_closed', code: MSE_CLIENT_CLOSE.CONNECT_FAILED[0], reason: MSE_CLIENT_CLOSE.CONNECT_FAILED[1] });
			}, LIVE_CONNECT_TIMEOUT_MS);
		}

		if (next.state === 'playing' && next.attempt !== 0) {
			stableTimer = setTimeout(() => {
				stableTimer = null;
				send({ type: 'playing_stable' });
			}, LIVE_STABLE_AFTER_MS);
		}

		if (next.state === 'error' && next.retryInMs !== null) {
			retryTimer = setTimeout(() => {
				retryTimer = null;
				send({ type: 'retry_due' });
			}, next.retryInMs);
		}

		if (next.state === 'relay_unavailable' && previous.state !== 'relay_unavailable') {
			const known = relayStatusStore.status;

			relaySeenDown = known !== null && known.relay.state !== CamerasModuleDataRelayStatusState.running;
		}

		if (previous.state === 'offline' && next.state === 'snapshot' && wantsPlayback) {
			send({ type: 'start' });
		}

		const waiting = RELAY_WAIT_STATES.has(next.state);

		if (waiting && !RELAY_WAIT_STATES.has(previous.state)) {
			holdRelayPolling();
		} else if (!waiting) {
			releaseRelayPolling();
		}
	}

	// A relay that comes back while the view waits for it retries once; a relay that never looked down does not, so a
	// socket refused for the relay while the status reports it running cannot loop.
	watch(
		() => relayStatusStore.status?.relay.state ?? null,
		(state) => {
			if (context.value.state !== 'relay_unavailable' || state === null) {
				return;
			}

			if (state !== CamerasModuleDataRelayStatusState.running) {
				relaySeenDown = true;

				return;
			}

			if (relaySeenDown) {
				relaySeenDown = false;
				send({ type: 'retry' });
			}
		}
	);

	watch(
		() => toValue(options.deviceId),
		(deviceId) => {
			if (devicesStore.findById(deviceId) === null) {
				devicesStore.get({ id: deviceId }).catch((): void => {
					logger.warn('Failed to load the camera device for the live view.');
				});
			}
		},
		{ immediate: true }
	);

	watch(
		() => isDeviceOffline(device.value),
		(offline) => {
			if (offline === true) {
				send({ type: 'device_offline' });
			} else if (offline === false) {
				// Ignored by the machine unless the view is offline.
				send({ type: 'device_online' });
			}
		},
		{ immediate: true }
	);

	// A new selection starts a fresh attempt with a fresh retry budget, also while a backoff of the old one is pending;
	// only the backoff timer of the same selection keeps the count.
	watch([() => toValue(options.deviceId), () => toValue(options.profile)], () => {
		const { state, retryInMs } = context.value;

		if (ACTIVE_STATES.has(state) || (state === 'error' && retryInMs !== null)) {
			send({ type: 'stop' });
			send({ type: 'start' });
		}
	});

	const start = (): void => {
		wantsPlayback = autoPlay;
		send({ type: 'start' });
	};

	const stop = (): void => {
		wantsPlayback = false;
		send({ type: 'stop' });
	};

	const retry = (): void => {
		wantsPlayback = autoPlay;
		send({ type: 'retry' });
	};

	onScopeDispose(() => {
		disposed = true;
		queue.length = 0;
		clearTimers();
		teardownSession();
		releaseRelayPolling();
	});

	if (autoPlay) {
		send({ type: 'start' });
	}

	return {
		state: computed(() => context.value.state),
		retryInMs: computed(() => context.value.retryInMs),
		reconnect: computed(() => context.value.reconnect),
		mime: computed(() => mime.value),
		lastSeen: computed(() => device.value?.status.lastChanged ?? null),
		start,
		stop,
		retry,
	};
};
