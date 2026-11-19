import { type MaybeRefOrGetter, type Ref, onScopeDispose, ref, toValue, watch } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { CAMERAS_MODULE_PREFIX, SNAPSHOT_REFRESH_MS } from '../cameras.constants';
import { isModuleDisabledError, readErrorMessage } from '../cameras.utils';

export type CameraSnapshotError = 'offline' | 'busy' | 'unavailable' | 'module_disabled' | 'not_found' | 'failed';

export interface IUseCameraSnapshotOptions {
	profile?: MaybeRefOrGetter<string | null>;
	hq?: boolean;
	refreshMs?: number | null;
	active?: MaybeRefOrGetter<boolean>;
}

export interface IUseCameraSnapshot {
	url: Ref<string | null>;
	ageSeconds: Ref<number | null>;
	takenAt: Ref<Date | null>;
	/** The type of the current snapshot blob, such as `image/jpeg`. */
	mimeType: Ref<string | null>;
	error: Ref<CameraSnapshotError | null>;
	loading: Ref<boolean>;
	reload: (options?: { hq?: boolean }) => Promise<void>;
}

const mapError = (status: number, error: unknown, headers: Headers | undefined): CameraSnapshotError => {
	if (isModuleDisabledError(status, error)) {
		return 'module_disabled';
	}

	if (status === 404) {
		return 'not_found';
	}

	if (status === 503) {
		const message = readErrorMessage(error);

		if (message === 'Camera is offline') {
			return 'offline';
		}

		if (message === 'Camera is busy' || headers?.has('Retry-After')) {
			return 'busy';
		}

		return 'unavailable';
	}

	return 'failed';
};

export const useCameraSnapshot = (deviceId: MaybeRefOrGetter<string>, options: IUseCameraSnapshotOptions = {}): IUseCameraSnapshot => {
	const backend = useBackend();

	const url = ref<string | null>(null);
	const ageSeconds = ref<number | null>(null);
	const takenAt = ref<Date | null>(null);
	const mimeType = ref<string | null>(null);
	const error = ref<CameraSnapshotError | null>(null);
	const loading = ref(false);

	let controller: AbortController | null = null;
	let requestId = 0;
	let inFlight = false;
	let timer: ReturnType<typeof setInterval> | null = null;
	let disposed = false;
	/** Set by an answer that will not change on its own (no camera, module off); only another device or profile clears it. */
	let halted = false;

	const isActive = (): boolean => (options.active === undefined ? true : toValue(options.active));
	const isVisible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';

	const revokeCurrent = (): void => {
		if (url.value !== null) {
			URL.revokeObjectURL(url.value);
			url.value = null;
		}
	};

	const abortRunning = (): void => {
		requestId++;
		controller?.abort();
		controller = null;
		inFlight = false;
		loading.value = false;
	};

	const load = async (hq: boolean): Promise<void> => {
		abortRunning();

		const id = ++requestId;
		const abortController = new AbortController();

		controller = abortController;
		inFlight = true;
		loading.value = true;

		const profile = options.profile === undefined ? null : toValue(options.profile);
		const query: { profile?: string; hq: 'true' | 'false' } = { hq: hq ? 'true' : 'false' };

		if (profile) {
			query.profile = profile;
		}

		try {
			const {
				data,
				error: apiError,
				response,
			} = (await backend.client.GET(`/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/cameras/{deviceId}/snapshot`, {
				params: { path: { deviceId: toValue(deviceId) }, query },
				signal: abortController.signal,
				parseAs: 'blob',
			} as never)) as { data?: Blob; error?: unknown; response?: Response };

			if (id !== requestId || disposed) {
				return;
			}

			if (apiError !== undefined || !data) {
				error.value = mapError(response?.status ?? 0, apiError, response?.headers);

				if (error.value === 'not_found' || error.value === 'module_disabled') {
					halted = true;
					stopTimer();
				}

				return;
			}

			const age = Number(response?.headers.get('X-Snapshot-Age'));
			const nextUrl = URL.createObjectURL(data);

			revokeCurrent();
			url.value = nextUrl;
			mimeType.value = data.type || null;
			ageSeconds.value = Number.isFinite(age) && age >= 0 ? age : 0;
			takenAt.value = new Date(Date.now() - ageSeconds.value * 1000);
			error.value = null;
		} catch {
			if (id === requestId && !disposed) {
				error.value = 'failed';
			}
		} finally {
			if (id === requestId) {
				inFlight = false;
				loading.value = false;
				controller = null;
			}
		}
	};

	const reload = (reloadOptions?: { hq?: boolean }): Promise<void> => load(reloadOptions?.hq ?? options.hq ?? false);

	const onTick = (): void => {
		if (!halted && !inFlight && isVisible() && isActive()) {
			void reload();
		}
	};

	const onVisibilityChange = (): void => {
		if (!halted && !inFlight && isVisible() && isActive()) {
			void reload();
		}
	};

	const startTimer = (): void => {
		const interval = options.refreshMs === undefined ? SNAPSHOT_REFRESH_MS : options.refreshMs;

		if (timer === null && interval !== null && interval > 0) {
			timer = setInterval(onTick, interval);
		}
	};

	function stopTimer(): void {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange);
	}

	startTimer();

	watch(
		() => [toValue(deviceId), options.profile === undefined ? null : toValue(options.profile)],
		() => {
			abortRunning();
			revokeCurrent();
			ageSeconds.value = null;
			takenAt.value = null;
			mimeType.value = null;
			error.value = null;
			halted = false;
			startTimer();

			if (isVisible() && isActive()) {
				void reload();
			}
		}
	);

	watch(isActive, (active) => {
		if (active && !halted && !inFlight && isVisible()) {
			void reload();
		}
	});

	if (isVisible() && isActive()) {
		void reload();
	}

	onScopeDispose(() => {
		disposed = true;

		stopTimer();

		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		}

		abortRunning();
		revokeCurrent();
	});

	return { url, ageSeconds, takenAt, mimeType, error, loading, reload };
};
