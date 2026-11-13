import { FAKE_CAMERA_SECRET_URL } from '../../../../test/support/fake-camera-stream.provider';
import { CameraProfileUnavailableException, CameraUpstreamException } from '../cameras.exceptions';

import { go2rtcStreamName, toGo2rtcSource } from './go2rtc-source';

describe('toGo2rtcSource', () => {
	it.each([
		[{ url: 'rtsp://cam/stream', transport: 'rtsp' }, 'rtsp://cam/stream'],
		[{ url: 'rtsps://cam/stream', transport: 'rtsp' }, 'rtsps://cam/stream'],
		[{ url: 'rtsps://c:7441/ALIAS?enableSrtp', transport: 'rtsps-insecure' }, 'rtspx://c:7441/ALIAS?enableSrtp'],
		[{ url: 'rtspx://c:7441/ALIAS', transport: 'rtsps-insecure' }, 'rtspx://c:7441/ALIAS'],
		[{ url: 'https://cam/video.mjpeg', transport: 'http' }, 'https://cam/video.mjpeg'],
		[{ url: 'http://cam/video.mjpeg', transport: 'http' }, 'http://cam/video.mjpeg'],
	] as const)('maps %j', (source, expected) => {
		expect(toGo2rtcSource(source)).toBe(expected);
	});

	it.each([
		{ url: 'exec:ffmpeg -i x', transport: 'rtsp' },
		{ url: 'ffmpeg:rtsp://cam/x', transport: 'rtsp' },
		{ url: 'http://cam/x', transport: 'rtsp' },
		{ url: 'rtsp://cam/x', transport: 'rtsps-insecure' },
		{ url: 'rtsp://cam/x\nexec:id', transport: 'rtsp' },
		{ url: 'rtsp://cam/x#frag', transport: 'rtsp' },
		{ url: 'not a url', transport: 'http' },
		{ url: 'rtsp://cam/x', transport: 'webrtc' },
		{ url: 'rtsp://cam/x', transport: '__proto__' },
	])('refuses %j without echoing it', (source) => {
		expect(() => toGo2rtcSource(source as never)).toThrow(CameraUpstreamException);
		expect(() => toGo2rtcSource(source as never)).toThrow(/^Unsupported stream source$/);
	});

	it('never puts the source url into the error', () => {
		const source = { url: `${FAKE_CAMERA_SECRET_URL}\nexec:id`, transport: 'rtsps-insecure' as const };

		expect(() => toGo2rtcSource(source)).toThrow(CameraUpstreamException);

		try {
			toGo2rtcSource(source);
		} catch (e) {
			expect((e as Error).message).not.toContain('SENTINELALIAS');
		}
	});
});

describe('go2rtcStreamName', () => {
	it('names streams by device and profile', () => {
		expect(go2rtcStreamName('c1', 'medium')).toBe('smart-panel_c1_medium');
	});

	it.each(['', 'has space', 'a/b', 'x'.repeat(65)])('refuses the profile id %#', (profileId) => {
		expect(() => go2rtcStreamName('c1', profileId)).toThrow(CameraProfileUnavailableException);
	});
});
