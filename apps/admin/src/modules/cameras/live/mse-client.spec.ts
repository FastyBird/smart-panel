import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MSE_CLIENT_CLOSE, MSE_MAX_QUEUED_BYTES, MseClient, type MseClientEvent } from './mse-client';

const SOCKET_URL = 'ws://panel.local/api/v1/modules/cameras/live?session=secret-token';
const MIME = 'video/mp4; codecs="avc1.640029,mp4a.40.2"';
const HALF_CAP = MSE_MAX_QUEUED_BYTES / 2;
const OBJECT_URL = 'blob:live-1';

class FakeSocket extends EventTarget {
	binaryType: BinaryType = 'blob';
	sent: string[] = [];
	close = vi.fn();

	send(data: string): void {
		this.sent.push(data);
	}

	open(): void {
		this.dispatchEvent(new Event('open'));
	}

	text(data: unknown): void {
		this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
	}

	binary(bytes: number): void {
		this.dispatchEvent(new MessageEvent('message', { data: new ArrayBuffer(bytes) }));
	}

	serverClose(code: number, reason: string): void {
		this.dispatchEvent(new CloseEvent('close', { code, reason }));
	}
}

class FakeSourceBuffer extends EventTarget {
	updating = false;
	mode: AppendMode = 'sequence';
	ranges: [number, number][] = [];
	ops: string[] = [];
	concurrent = false;
	quotaFailures = 0;

	get buffered(): TimeRanges {
		const ranges = this.ranges;

		return { length: ranges.length, start: (i: number) => ranges[i][0], end: (i: number) => ranges[i][1] };
	}

	appendBuffer(data: ArrayBuffer): void {
		this.concurrent ||= this.updating;

		if (this.quotaFailures > 0) {
			this.quotaFailures--;
			this.ops.push('quota');

			throw new DOMException('full', 'QuotaExceededError');
		}

		this.ops.push(`append ${data.byteLength}`);
		this.updating = true;
	}

	remove(start: number, end: number): void {
		this.concurrent ||= this.updating;
		this.ops.push(`remove ${start}-${end}`);
		this.updating = true;
	}

	finish(): void {
		this.updating = false;
		this.dispatchEvent(new Event('updateend'));
	}
}

const makeMediaSource = (codecs: string[], mimes: string[]) =>
	class FakeMediaSource extends EventTarget {
		static instances: FakeMediaSource[] = [];

		readyState: ReadyState = 'closed';
		sourceBuffers: FakeSourceBuffer[] = [];
		endOfStream = vi.fn();
		addSourceBuffer = vi.fn((): FakeSourceBuffer => {
			const buffer = new FakeSourceBuffer();

			this.sourceBuffers.push(buffer);

			return buffer;
		});

		constructor() {
			super();
			FakeMediaSource.instances.push(this);
		}

		static isTypeSupported(type: string): boolean {
			return mimes.includes(type) || codecs.some((codec) => type === `video/mp4; codecs="${codec}"`);
		}

		open(): void {
			this.readyState = 'open';
			this.dispatchEvent(new Event('sourceopen'));
		}
	};

const setup = ({ codecs = ['avc1.640029', 'mp4a.40.2'], mimes = [MIME] }: { codecs?: string[]; mimes?: string[] } = {}) => {
	const Source = makeMediaSource(codecs, mimes);
	const video = document.createElement('video');
	const play = vi.fn(() => Promise.resolve());
	const load = vi.fn();
	let currentTime = 0;

	video.play = play;
	video.load = load;
	Object.defineProperty(video, 'currentTime', {
		configurable: true,
		get: () => currentTime,
		set: (value: number) => {
			currentTime = value;
		},
	});

	const sockets: FakeSocket[] = [];
	const createSocket = vi.fn((): WebSocket => {
		const socket = new FakeSocket();

		sockets.push(socket);

		return socket as unknown as WebSocket;
	});
	const events: MseClientEvent[] = [];
	const client = new MseClient({
		url: SOCKET_URL,
		video,
		mediaSource: Source as unknown as typeof MediaSource,
		createSocket,
		onEvent: (event) => events.push(event),
	});

	return {
		client,
		video,
		play,
		load,
		createSocket,
		events,
		socket: (): FakeSocket => sockets[0],
		source: () => Source.instances[0],
		buffer: (): FakeSourceBuffer => Source.instances[0].sourceBuffers[0],
	};
};

const ready = (ctx: ReturnType<typeof setup>): FakeSourceBuffer => {
	ctx.client.start();
	ctx.socket().open();
	ctx.socket().text({ type: 'mse', value: MIME });
	ctx.source().open();

	return ctx.buffer();
};

describe('MseClient', () => {
	let createSpy: MockInstance<typeof URL.createObjectURL>;
	let revokeSpy: MockInstance<typeof URL.revokeObjectURL>;

	beforeEach(() => {
		createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => OBJECT_URL);
		revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('opens no socket when no codec is supported', () => {
		const ctx = setup({ codecs: [] });

		ctx.client.start();

		expect(ctx.events).toEqual([{ type: 'codec_unsupported' }]);
		expect(ctx.createSocket).not.toHaveBeenCalled();
		expect(createSpy).not.toHaveBeenCalled();
	});

	it('sets disableRemotePlayback and playsInline', () => {
		const ctx = setup();

		ctx.client.start();

		expect(ctx.video.muted).toBe(true);
		expect(ctx.video.playsInline).toBe(true);
		expect(ctx.video.disableRemotePlayback).toBe(true);
		expect(ctx.video.getAttribute('src')).toBe(OBJECT_URL);
	});

	it('sends one mse request with the supported codecs on open', () => {
		const ctx = setup({ codecs: ['avc1.640029', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'opus'] });

		ctx.client.start();

		expect(ctx.createSocket).toHaveBeenCalledWith(SOCKET_URL);
		expect(ctx.socket().binaryType).toBe('arraybuffer');
		expect(ctx.socket().sent).toEqual([]);

		ctx.socket().open();

		expect(ctx.socket().sent).toEqual([JSON.stringify({ type: 'mse', value: 'avc1.640029,hvc1.1.6.L153.B0,mp4a.40.2,opus' })]);
	});

	it('adds the source buffer on the mse reply when sourceopen came first', () => {
		const ctx = setup();

		ctx.client.start();
		ctx.source().open();
		ctx.socket().open();

		expect(ctx.source().addSourceBuffer).not.toHaveBeenCalled();

		ctx.socket().text({ type: 'mse', value: MIME });
		ctx.socket().binary(10);

		expect(ctx.source().addSourceBuffer).toHaveBeenCalledWith(MIME);
		expect(ctx.buffer().ops).toEqual(['append 10']);
	});

	it('fails with media_error and opens no socket when the media source cannot be created', () => {
		const events: MseClientEvent[] = [];
		const createSocket = vi.fn();
		const Broken = class {
			static isTypeSupported = (): boolean => true;

			constructor() {
				throw new DOMException('nope', 'NotSupportedError');
			}
		};
		const client = new MseClient({
			url: SOCKET_URL,
			video: document.createElement('video'),
			mediaSource: Broken as unknown as typeof MediaSource,
			createSocket,
			onEvent: (event) => events.push(event),
		});
		const [code, reason] = MSE_CLIENT_CLOSE.MEDIA_ERROR;

		client.start();

		expect(events).toEqual([{ type: 'closed', code, reason }]);
		expect(createSocket).not.toHaveBeenCalled();
		expect(createSpy).not.toHaveBeenCalled();
	});

	it('waits for sourceopen before adding the source buffer', () => {
		const ctx = setup();

		ctx.client.start();
		ctx.socket().open();
		ctx.socket().text({ type: 'mse', value: MIME });
		ctx.socket().binary(10);

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }]);
		expect(ctx.source().addSourceBuffer).not.toHaveBeenCalled();

		ctx.source().open();

		expect(ctx.source().addSourceBuffer).toHaveBeenCalledWith(MIME);
		expect(ctx.buffer().mode).toBe('segments');
		expect(ctx.buffer().ops).toEqual(['append 10']);
	});

	it('reports codec_unsupported for an unsupported mse reply and closes', () => {
		const ctx = setup({ mimes: [] });

		ctx.client.start();
		ctx.socket().open();
		ctx.socket().text({ type: 'mse', value: 'video/mp4; codecs="hvc1.1.6.L153.B0"' });

		expect(ctx.events).toEqual([{ type: 'codec_unsupported' }]);
		expect(ctx.socket().close).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledWith(OBJECT_URL);
	});

	it('never runs remove while an append is updating', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.video.currentTime = 99;
		ctx.socket().binary(1);
		ctx.socket().binary(2);

		expect(buffer.ops).toEqual(['append 1']);

		buffer.ranges = [[0, 100]];
		buffer.finish();

		expect(buffer.ops).toEqual(['append 1', 'remove 0-69']);

		ctx.socket().binary(3);
		buffer.finish();
		buffer.finish();
		buffer.finish();

		expect(buffer.ops).toEqual(['append 1', 'remove 0-69', 'append 2', 'remove 0-69', 'append 3']);
		expect(buffer.concurrent).toBe(false);
	});

	it('trims the buffer to 30 s once more than 40 s are buffered', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.video.currentTime = 95;
		ctx.socket().binary(1);
		buffer.ranges = [[55, 96]];
		buffer.finish();

		// Exactly 40 s behind the playhead: nothing is removed yet.
		expect(buffer.ops).toEqual(['append 1']);

		ctx.socket().binary(2);
		buffer.ranges = [[10, 96]];
		buffer.finish();

		expect(buffer.ops).toEqual(['append 1', 'append 2', 'remove 10-65']);

		buffer.ranges = [[65, 96]];
		buffer.finish();
		ctx.socket().binary(3);
		buffer.finish();

		expect(buffer.ops).toEqual(['append 1', 'append 2', 'remove 10-65', 'append 3']);
	});

	it('closes with buffer_full when more than 16 MiB wait while streaming is paused', () => {
		const ctx = setup();
		const buffer = ready(ctx);
		const [code, reason] = MSE_CLIENT_CLOSE.BUFFER_FULL;

		ctx.source().dispatchEvent(new Event('endstreaming'));
		ctx.socket().binary(HALF_CAP);
		ctx.socket().binary(HALF_CAP);

		expect(ctx.events.some((event) => event.type === 'closed')).toBe(false);

		ctx.socket().binary(1);

		expect(buffer.ops).toEqual([]);
		expect(ctx.events.at(-1)).toEqual({ type: 'closed', code, reason });
		expect(ctx.socket().close).toHaveBeenCalledTimes(1);
	});

	it('closes with buffer_full when more than 16 MiB wait for the source buffer', () => {
		const ctx = setup();
		const [code, reason] = MSE_CLIENT_CLOSE.BUFFER_FULL;

		ctx.client.start();
		ctx.socket().open();
		ctx.socket().text({ type: 'mse', value: MIME });
		ctx.socket().binary(HALF_CAP);
		ctx.socket().binary(HALF_CAP + 1);

		expect(ctx.source().addSourceBuffer).not.toHaveBeenCalled();
		expect(ctx.events.at(-1)).toEqual({ type: 'closed', code, reason });
	});

	it('counts appended fragments out of the queued bytes', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		for (let i = 0; i < 3; i++) {
			ctx.socket().binary(HALF_CAP);
			buffer.finish();
		}

		expect(buffer.ops).toEqual([`append ${HALF_CAP}`, `append ${HALF_CAP}`, `append ${HALF_CAP}`]);
		expect(ctx.events.some((event) => event.type === 'closed')).toBe(false);
	});

	it('jumps to the live edge when more than 5 s behind', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.video.currentTime = 10;
		ctx.socket().binary(1);
		buffer.ranges = [[0, 15]];
		buffer.finish();

		expect(ctx.video.currentTime).toBe(10);

		ctx.socket().binary(1);
		buffer.ranges = [[0, 15.5]];
		buffer.finish();

		expect(ctx.video.currentTime).toBe(15);
	});

	it('retries an append once after QuotaExceededError', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.video.currentTime = 90;
		buffer.ranges = [[0, 91]];
		buffer.quotaFailures = 1;
		ctx.socket().binary(4);

		expect(buffer.ops).toEqual(['quota', 'remove 0-60']);

		buffer.finish();

		expect(buffer.ops).toEqual(['quota', 'remove 0-60', 'append 4']);
		expect(ctx.events.some((event) => event.type === 'closed')).toBe(false);
	});

	it('closes with a fixed error when the retried append is still over quota', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.video.currentTime = 90;
		buffer.ranges = [[0, 91]];
		buffer.quotaFailures = 2;
		ctx.socket().binary(4);
		buffer.finish();

		const [code, reason] = MSE_CLIENT_CLOSE.BUFFER_FULL;

		expect(buffer.ops).toEqual(['quota', 'remove 0-60', 'quota']);
		expect(ctx.events.at(-1)).toEqual({ type: 'closed', code, reason });
		expect(ctx.socket().close).toHaveBeenCalledTimes(1);
	});

	it('pauses appends between endstreaming and startstreaming', () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.source().dispatchEvent(new Event('endstreaming'));
		ctx.socket().binary(1);

		expect(buffer.ops).toEqual([]);

		ctx.source().dispatchEvent(new Event('startstreaming'));

		expect(buffer.ops).toEqual(['append 1']);
	});

	it('emits media_started once on the playing event', async () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.socket().binary(1);
		buffer.finish();

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }]);

		await Promise.resolve();
		await Promise.resolve();

		expect(ctx.play).toHaveBeenCalledTimes(1);

		ctx.video.dispatchEvent(new Event('playing'));
		ctx.video.dispatchEvent(new Event('playing'));

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }, { type: 'media_started' }]);
	});

	it('emits media_started once when autoplay is blocked, so the view can offer play', async () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.play.mockImplementation(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
		ctx.socket().binary(1);
		buffer.finish();

		for (let i = 0; i < 4; i++) {
			await Promise.resolve();
		}

		expect(ctx.play).toHaveBeenCalledTimes(1);
		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }, { type: 'media_started' }]);

		// The user presses play later: the playing event must not report the start again.
		ctx.video.dispatchEvent(new Event('playing'));

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }, { type: 'media_started' }]);
	});

	it('does not emit media_started when play fails for another reason', async () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.play.mockImplementation(() => Promise.reject(new DOMException('aborted', 'AbortError')));
		ctx.socket().binary(1);
		buffer.finish();

		for (let i = 0; i < 4; i++) {
			await Promise.resolve();
		}

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }]);
	});

	it('does not emit media_started for a blocked play that settles after close', async () => {
		const ctx = setup();
		const buffer = ready(ctx);
		let reject: (error: unknown) => void = () => undefined;

		ctx.play.mockImplementation(() => new Promise<void>((_, rejectPlay) => (reject = rejectPlay)));
		ctx.socket().binary(1);
		buffer.finish();

		await Promise.resolve();
		await Promise.resolve();

		ctx.client.close();
		reject(new DOMException('blocked', 'NotAllowedError'));

		for (let i = 0; i < 4; i++) {
			await Promise.resolve();
		}

		expect(ctx.events).toEqual([{ type: 'mime', mime: MIME }]);
	});

	it('reports the close code and reason', () => {
		const ctx = setup();

		ready(ctx);
		ctx.socket().serverClose(1013, 'session_limit');

		expect(ctx.events.at(-1)).toEqual({ type: 'closed', code: 1013, reason: 'session_limit' });
		expect(revokeSpy).toHaveBeenCalledWith(OBJECT_URL);
		expect(ctx.video.hasAttribute('src')).toBe(false);
	});

	it('does not call play after close', async () => {
		const ctx = setup();
		const buffer = ready(ctx);

		ctx.socket().binary(1);
		buffer.finish();
		ctx.client.close();

		await Promise.resolve();
		await Promise.resolve();

		expect(ctx.play).not.toHaveBeenCalled();
	});

	it('tears down the socket, then the source, then the video and the object url', () => {
		const ctx = setup();
		const order: string[] = [];

		ready(ctx);
		ctx.socket().close.mockImplementation(() => order.push('socket.close'));
		ctx.source().endOfStream.mockImplementation(() => order.push('endOfStream'));
		vi.spyOn(ctx.video, 'removeAttribute').mockImplementation((name: string) => {
			order.push(`removeAttribute ${name}`);
		});
		ctx.load.mockImplementation(() => order.push('load'));
		revokeSpy.mockImplementation(() => order.push('revokeObjectURL'));

		ctx.client.close();

		expect(order).toEqual(['socket.close', 'endOfStream', 'removeAttribute src', 'load', 'revokeObjectURL']);
	});

	it('close is idempotent, releases the video and emits nothing', () => {
		const ctx = setup();

		ready(ctx);
		ctx.events.length = 0;

		ctx.client.close();
		ctx.client.close();

		expect(ctx.socket().close).toHaveBeenCalledTimes(1);
		expect(ctx.source().endOfStream).toHaveBeenCalledTimes(1);
		expect(ctx.video.hasAttribute('src')).toBe(false);
		expect(ctx.load).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledWith(OBJECT_URL);

		ctx.socket().serverClose(1000, '');
		ctx.socket().binary(1);
		ctx.video.dispatchEvent(new Event('playing'));

		expect(ctx.events).toEqual([]);
		expect(ctx.buffer().ops).toEqual([]);
	});
});
