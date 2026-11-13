import { stringify } from 'yaml';

export interface Go2rtcRuntimeConfig {
	apiPort: number;
	rtspPort: number;
	username: string;
	password: string;
}

const PASSWORD_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const USERNAME_PATTERN = /^[a-z0-9-]{1,32}$/;

const isPort = (value: number): boolean => Number.isInteger(value) && value >= 1 && value <= 65535;

/**
 * Builds the go2rtc configuration document. Every listener is bound to loopback or disabled, and the document never
 * contains a stream: streams are registered at runtime through the API. The error messages never echo a credential.
 */
export function buildGo2rtcConfig(options: Go2rtcRuntimeConfig): string {
	if (!isPort(options.apiPort) || !isPort(options.rtspPort)) {
		throw new Error('Invalid go2rtc port');
	}

	if (!USERNAME_PATTERN.test(options.username)) {
		throw new Error('Invalid go2rtc username');
	}

	if (!PASSWORD_PATTERN.test(options.password)) {
		throw new Error('Invalid go2rtc password');
	}

	return stringify({
		api: {
			listen: `127.0.0.1:${options.apiPort}`,
			username: options.username,
			password: options.password,
			local_auth: true,
		},
		rtsp: {
			listen: `127.0.0.1:${options.rtspPort}`,
			username: options.username,
			password: options.password,
		},
		webrtc: { listen: '' },
		srtp: { listen: '' },
		log: { level: 'info', format: 'text' },
	});
}
