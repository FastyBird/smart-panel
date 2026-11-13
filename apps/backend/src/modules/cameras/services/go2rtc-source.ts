import { GO2RTC_STREAM_NAME_PREFIX } from '../cameras.constants';
import { CameraProfileUnavailableException, CameraUpstreamException } from '../cameras.exceptions';
import { CameraStreamSource } from '../platforms/camera-stream.provider';

const PROFILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[\s\u0000-\u001f\u007f]/;

const ACCEPTED_SCHEMES: Record<CameraStreamSource['transport'], string[]> = {
	rtsp: ['rtsp:', 'rtsps:'],
	'rtsps-insecure': ['rtsps:', 'rtspx:'],
	http: ['http:', 'https:'],
};

/**
 * Maps a provider stream source to a go2rtc source. Anything that is not a plain URL of the declared transport is
 * refused so that go2rtc source syntax that runs a command (`exec:`, `ffmpeg:`) can never be reached. The source is a
 * secret: the error message never contains it.
 */
export function toGo2rtcSource(source: CameraStreamSource): string {
	const unsupported = () => new CameraUpstreamException('Unsupported stream source');

	const schemes = Object.prototype.hasOwnProperty.call(ACCEPTED_SCHEMES, source?.transport)
		? ACCEPTED_SCHEMES[source.transport]
		: undefined;

	if (!schemes || typeof source.url !== 'string' || FORBIDDEN_CHARACTERS.test(source.url)) {
		throw unsupported();
	}

	let parsed: URL;

	try {
		parsed = new URL(source.url);
	} catch {
		throw unsupported();
	}

	if (!schemes.includes(parsed.protocol) || parsed.hash !== '' || source.url.includes('#')) {
		throw unsupported();
	}

	if (source.transport === 'rtsps-insecure') {
		return source.url.replace(/^[a-z]+:/i, 'rtspx:');
	}

	return source.url;
}

/** `smart-panel_<installationId>_`: the prefix of every stream name this installation registers. */
export function go2rtcStreamPrefix(installationId: string): string {
	return `${GO2RTC_STREAM_NAME_PREFIX}${installationId}_`;
}

export function go2rtcStreamName(installationId: string, deviceId: string, profileId: string): string {
	if (!PROFILE_ID_PATTERN.test(profileId)) {
		throw new CameraProfileUnavailableException('Stream profile is not available');
	}

	return `${go2rtcStreamPrefix(installationId)}${deviceId}_${profileId}`;
}
