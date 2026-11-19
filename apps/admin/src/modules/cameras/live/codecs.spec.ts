import { describe, expect, it } from 'vitest';

import { MSE_CODECS, canPlayProfileCodec, describeMime, getMediaSourceCtor, supportedCodecs } from './codecs';

const fakeCtor = (supported: string[]): typeof MediaSource =>
	({
		isTypeSupported: (type: string): boolean => supported.some((codec) => type === `video/mp4; codecs="${codec}"`),
	}) as unknown as typeof MediaSource;

const fakeWindow = (props: Record<string, unknown>): Window => props as unknown as Window;

describe('codecs', () => {
	it('lists the go2rtc codecs', () => {
		expect(MSE_CODECS).toEqual(['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0', 'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus']);
	});

	it('prefers MediaSource and falls back to ManagedMediaSource', () => {
		const mediaSource = fakeCtor([]);
		const managed = fakeCtor([]);

		expect(getMediaSourceCtor(fakeWindow({ MediaSource: mediaSource, ManagedMediaSource: managed }))).toBe(mediaSource);
		expect(getMediaSourceCtor(fakeWindow({ ManagedMediaSource: managed }))).toBe(managed);
	});

	it('returns null without either', () => {
		expect(getMediaSourceCtor(fakeWindow({}))).toBeNull();
	});

	it('joins the supported subset with commas', () => {
		expect(supportedCodecs(fakeCtor(['avc1.640029', 'mp4a.40.2', 'opus']))).toBe('avc1.640029,mp4a.40.2,opus');
		expect(supportedCodecs(fakeCtor([]))).toBe('');
	});

	it('canPlayProfileCodec reports h265 as unsupported when hvc1 is not supported', () => {
		const ctor = fakeCtor(['avc1.640029']);

		expect(canPlayProfileCodec('h265', ctor)).toBe(false);
		expect(canPlayProfileCodec('HEVC', ctor)).toBe(false);
		expect(canPlayProfileCodec('h264', ctor)).toBe(true);
		expect(canPlayProfileCodec('avc', ctor)).toBe(true);
		expect(canPlayProfileCodec('h265', fakeCtor(['hvc1.1.6.L153.B0']))).toBe(true);
		expect(canPlayProfileCodec('h264', fakeCtor([]))).toBe(false);
	});

	it('assumes an unknown or missing profile codec can play', () => {
		const ctor = fakeCtor([]);

		expect(canPlayProfileCodec(null, ctor)).toBe(true);
		expect(canPlayProfileCodec('mjpeg', ctor)).toBe(true);
	});

	it('describes the codecs of a mime type', () => {
		expect(describeMime('video/mp4; codecs="avc1.640029,mp4a.40.2"')).toEqual({ video: 'H.264', audio: 'AAC' });
		expect(describeMime('video/mp4; codecs="hvc1.1.6.L153.B0,opus"')).toEqual({ video: 'H.265', audio: 'Opus' });
		expect(describeMime('video/mp4; codecs="hev1.1.6.L153.B0,flac"')).toEqual({ video: 'H.265', audio: 'FLAC' });
		expect(describeMime('video/mp4; codecs="avc1.64002A"')).toEqual({ video: 'H.264', audio: null });
		expect(describeMime('video/mp4')).toEqual({ video: null, audio: null });
	});
});
