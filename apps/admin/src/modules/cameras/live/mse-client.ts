import { supportedCodecs } from './codecs';

export type MseClientEvent =
	| { type: 'mime'; mime: string }
	| { type: 'media_started' }
	| { type: 'codec_unsupported' }
	| { type: 'closed'; code: number; reason: string };

export interface MseClientOptions {
	/** The live socket url. It carries the session token, so it goes only to the socket constructor. */
	url: string;
	video: HTMLVideoElement;
	/** `MediaSource` or Safari's `ManagedMediaSource`, see `getMediaSourceCtor`. */
	mediaSource: typeof MediaSource;
	createSocket?: (url: string) => WebSocket;
	onEvent: (event: MseClientEvent) => void;
}

/**
 * Failures of the client itself, reported like a socket close. The codes 4900–4902 are client-local: they are never
 * sent over the wire, and the server must never use them (its codes are in `LIVE_CLOSE`). The state machine treats them
 * as retryable errors.
 */
export const MSE_CLIENT_CLOSE = {
	CONNECT_FAILED: [4900, 'connect_failed'],
	BUFFER_FULL: [4901, 'buffer_full'],
	MEDIA_ERROR: [4902, 'media_error'],
} as const;

/** Media kept behind the playhead: once more than `BUFFER_TRIM_AT_S` is buffered behind it, it is trimmed back. */
const BUFFER_KEEP_S = 30;
const BUFFER_TRIM_AT_S = 40;
/**
 * Fragments waiting for the source buffer (before it exists, or while ManagedMediaSource pauses streaming). The browser
 * keeps reading the socket, so the server's backpressure never applies; above this the client gives up.
 */
export const MSE_MAX_QUEUED_BYTES = 16 * 1024 * 1024;
/** When the playhead is further behind the buffered end, it jumps to the live edge. */
const LIVE_EDGE_MAX_LAG_S = 5;
const LIVE_EDGE_TARGET_LAG_S = 0.5;

type Operation = { kind: 'append'; data: ArrayBuffer; retried: boolean } | { kind: 'remove'; start: number; end: number };

const isQuotaExceeded = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'name' in error && error.name === 'QuotaExceededError';

const openSocket = (url: string): WebSocket => new WebSocket(url);

/**
 * Plays one go2rtc MSE stream: sends the `mse` request, feeds the fMP4 fragments into a `SourceBuffer` through a single
 * operation queue and reports what happened. It never retries; the live view state machine decides.
 */
export class MseClient {
	private readonly options: MseClientOptions;
	private readonly listeners = new AbortController();
	private socket: WebSocket | null = null;
	private source: MediaSource | null = null;
	private sourceBuffer: SourceBuffer | null = null;
	private objectUrl: string | null = null;
	private mime: string | null = null;
	private queue: Operation[] = [];
	private queuedBytes = 0;
	private current: Operation | null = null;
	private sourceOpen = false;
	private streaming = true;
	private started = false;
	private playRequested = false;
	private mediaStarted = false;
	private closed = false;

	constructor(options: MseClientOptions) {
		this.options = options;
	}

	start(): void {
		if (this.started || this.closed) {
			return;
		}

		this.started = true;

		const codecs = supportedCodecs(this.options.mediaSource);

		if (codecs === '') {
			this.closed = true;
			this.options.onEvent({ type: 'codec_unsupported' });

			return;
		}

		const { signal } = this.listeners;
		const { video } = this.options;

		// ManagedMediaSource (iOS) only attaches to a video without remote playback.
		video.muted = true;
		video.playsInline = true;
		video.disableRemotePlayback = true;
		video.addEventListener('playing', () => this.onPlaying(), { signal });
		video.addEventListener('error', () => this.fail(MSE_CLIENT_CLOSE.MEDIA_ERROR), { signal });

		try {
			const source = new this.options.mediaSource();

			this.source = source;
			source.addEventListener('sourceopen', () => this.onSourceOpen(), { signal });
			// Fired only by ManagedMediaSource: the browser asks to pause appends to save power.
			source.addEventListener('endstreaming', () => (this.streaming = false), { signal });
			source.addEventListener('startstreaming', () => this.onStartStreaming(), { signal });

			this.objectUrl = URL.createObjectURL(source);
			video.src = this.objectUrl;
		} catch {
			this.fail(MSE_CLIENT_CLOSE.MEDIA_ERROR);

			return;
		}

		let socket: WebSocket;

		try {
			socket = (this.options.createSocket ?? openSocket)(this.options.url);
		} catch {
			this.fail(MSE_CLIENT_CLOSE.CONNECT_FAILED);

			return;
		}

		this.socket = socket;
		socket.binaryType = 'arraybuffer';
		socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'mse', value: codecs })), { signal });
		socket.addEventListener('message', (event: MessageEvent<unknown>) => this.onMessage(event.data), { signal });
		socket.addEventListener('close', (event: CloseEvent) => this.fail([event.code, event.reason]), { signal });
	}

	/** Releases the socket, the media source and the video. Idempotent; emits nothing. */
	close(): void {
		if (this.closed) {
			return;
		}

		this.closed = true;
		this.listeners.abort();
		this.queue = [];
		this.queuedBytes = 0;
		this.current = null;
		this.socket?.close();
		this.socket = null;

		if (this.source?.readyState === 'open') {
			try {
				this.source.endOfStream();
			} catch {
				// The source is already ending or a buffer is updating; releasing the video detaches it anyway.
			}
		}

		this.source = null;
		this.sourceBuffer = null;

		if (this.objectUrl !== null) {
			this.options.video.removeAttribute('src');
			this.options.video.load();
			URL.revokeObjectURL(this.objectUrl);
			this.objectUrl = null;
		}
	}

	private fail([code, reason]: readonly [number, string]): void {
		if (this.closed) {
			return;
		}

		this.close();
		this.options.onEvent({ type: 'closed', code, reason });
	}

	private unsupported(): void {
		this.close();
		this.options.onEvent({ type: 'codec_unsupported' });
	}

	private onMessage(data: unknown): void {
		if (data instanceof ArrayBuffer) {
			this.enqueueAppend({ kind: 'append', data, retried: false }, false);

			if (this.queuedBytes > MSE_MAX_QUEUED_BYTES) {
				this.fail(MSE_CLIENT_CLOSE.BUFFER_FULL);

				return;
			}

			this.drain();
		} else if (typeof data === 'string') {
			this.onText(data);
		}
	}

	private enqueueAppend(operation: Extract<Operation, { kind: 'append' }>, first: boolean): void {
		this.queuedBytes += operation.data.byteLength;

		if (first) {
			this.queue.unshift(operation);
		} else {
			this.queue.push(operation);
		}
	}

	private onText(text: string): void {
		let message: unknown;

		try {
			message = JSON.parse(text);
		} catch {
			return;
		}

		if (typeof message !== 'object' || message === null || this.mime !== null) {
			return;
		}

		const { type, value } = message as { type?: unknown; value?: unknown };

		if (type !== 'mse' || typeof value !== 'string') {
			return;
		}

		if (!this.options.mediaSource.isTypeSupported(value)) {
			this.unsupported();

			return;
		}

		this.mime = value;
		this.options.onEvent({ type: 'mime', mime: value });
		this.openSourceBuffer();
	}

	private onSourceOpen(): void {
		this.sourceOpen = true;
		this.openSourceBuffer();
	}

	private onStartStreaming(): void {
		this.streaming = true;
		this.drain();
	}

	private onPlaying(): void {
		if (!this.mediaStarted) {
			this.mediaStarted = true;
			this.options.onEvent({ type: 'media_started' });
		}
	}

	private openSourceBuffer(): void {
		if (this.closed || !this.sourceOpen || this.mime === null || this.source === null || this.sourceBuffer !== null) {
			return;
		}

		try {
			this.sourceBuffer = this.source.addSourceBuffer(this.mime);
			this.sourceBuffer.mode = 'segments';
		} catch {
			this.fail(MSE_CLIENT_CLOSE.MEDIA_ERROR);

			return;
		}

		this.sourceBuffer.addEventListener('updateend', () => this.onUpdateEnd(), { signal: this.listeners.signal });
		this.drain();
	}

	/** Starts the next queued operation unless one is running; appends wait while ManagedMediaSource pauses streaming. */
	private drain(): void {
		const buffer = this.sourceBuffer;

		while (!this.closed && buffer !== null && this.current === null && !buffer.updating) {
			const operation = this.queue[0];

			if (operation === undefined || (operation.kind === 'append' && !this.streaming)) {
				return;
			}

			this.queue.shift();

			try {
				if (operation.kind === 'append') {
					this.queuedBytes -= operation.data.byteLength;
					buffer.appendBuffer(operation.data);
				} else {
					buffer.remove(operation.start, operation.end);
				}

				this.current = operation;
			} catch (error) {
				if (operation.kind === 'append' && !operation.retried && isQuotaExceeded(error)) {
					// Free old media first, then retry this fragment once.
					this.enqueueAppend({ ...operation, retried: true }, true);
					this.trim(true);

					continue;
				}

				this.fail(isQuotaExceeded(error) ? MSE_CLIENT_CLOSE.BUFFER_FULL : MSE_CLIENT_CLOSE.MEDIA_ERROR);

				return;
			}
		}
	}

	private onUpdateEnd(): void {
		const finished = this.current;

		this.current = null;

		if (finished?.kind === 'append') {
			this.seekToLiveEdge();
			this.trim(false);

			if (!this.playRequested) {
				this.playRequested = true;
				// Autoplay is muted; a rejection only means the user has to press play.
				void Promise.resolve()
					.then(() => (this.closed ? undefined : this.options.video.play()))
					.catch(() => undefined);
			}
		}

		this.drain();
	}

	private seekToLiveEdge(): void {
		const buffered = this.sourceBuffer?.buffered;

		if (buffered === undefined || buffered.length === 0) {
			return;
		}

		const end = buffered.end(buffered.length - 1);
		const { video } = this.options;

		if (end - video.currentTime > LIVE_EDGE_MAX_LAG_S) {
			video.currentTime = end - LIVE_EDGE_TARGET_LAG_S;
		}
	}

	/**
	 * Queues the removal of media older than `BUFFER_KEEP_S` ahead of the pending appends, once more than
	 * `BUFFER_TRIM_AT_S` is buffered behind the playhead, or always (`force`) to make room after a quota error.
	 */
	private trim(force: boolean): void {
		const buffered = this.sourceBuffer?.buffered;

		if (buffered === undefined || buffered.length === 0 || this.queue.some((operation) => operation.kind === 'remove')) {
			return;
		}

		const start = buffered.start(0);
		const { currentTime } = this.options.video;
		const end = currentTime - BUFFER_KEEP_S;

		if (end > start && (force || currentTime - start > BUFFER_TRIM_AT_S)) {
			this.queue.unshift({ kind: 'remove', start, end });
		}
	}
}
