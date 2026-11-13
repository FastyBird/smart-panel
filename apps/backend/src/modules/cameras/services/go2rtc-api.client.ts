import { GO2RTC_HTTP_TIMEOUT_MS } from '../cameras.constants';
import { Go2rtcApiError } from '../cameras.exceptions';

export interface Go2rtcEndpoint {
	/** For example `http://127.0.0.1:11984`, without a trailing slash. */
	baseUrl: string;
	/** The full `Authorization` header value (for example `Basic …`), or `null` for an unauthenticated endpoint. */
	authorization: string | null;
}

export interface Go2rtcInfo {
	version: string | null;
	configPath: string | null;
}

const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,32}$/;
const MAX_CONFIG_PATH_LENGTH = 4096;

/**
 * Thin client for the go2rtc HTTP API. Every failure rejects with a `Go2rtcApiError` that carries only the HTTP status
 * (or `null` when there was no response): the request url holds stream sources and is never echoed.
 */
export class Go2rtcApiClient {
	readonly authorization: string | null;

	private readonly baseUrl: string;

	constructor(
		endpoint: Go2rtcEndpoint,
		private readonly timeoutMs: number = GO2RTC_HTTP_TIMEOUT_MS,
	) {
		this.baseUrl = endpoint.baseUrl;
		this.authorization = endpoint.authorization;
	}

	async getInfo(): Promise<Go2rtcInfo> {
		const { status, body } = await this.request('GET', '/api');
		const parsed = parseObject(body, status);
		const version = typeof parsed.version === 'string' && VERSION_PATTERN.test(parsed.version) ? parsed.version : null;
		const configPath =
			typeof parsed.config_path === 'string' &&
			parsed.config_path.length > 0 &&
			parsed.config_path.length <= MAX_CONFIG_PATH_LENGTH
				? parsed.config_path
				: null;

		return { version, configPath };
	}

	async putStream(name: string, src: string): Promise<void> {
		await this.request('PUT', '/api/streams', { name, src });
	}

	/** go2rtc takes the stream name in `src`. A stream that is already gone (404) counts as deleted. */
	async deleteStream(name: string): Promise<void> {
		await this.request('DELETE', '/api/streams', { src: name }, [404]);
	}

	async listStreamNames(): Promise<string[]> {
		const { status, body } = await this.request('GET', '/api/streams');

		return Object.keys(parseObject(body, status));
	}

	wsUrl(name: string): string {
		return `${this.baseUrl.replace(/^http/, 'ws')}/api/ws?src=${encodeURIComponent(name)}`;
	}

	private async request(
		method: string,
		path: string,
		query?: Record<string, string>,
		acceptedStatuses: number[] = [],
	): Promise<{ status: number; body: string }> {
		const url = new URL(`${this.baseUrl}${path}`);

		for (const [key, value] of Object.entries(query ?? {})) {
			url.searchParams.set(key, value);
		}

		let status: number;
		let body: string;

		try {
			const response = await fetch(url, {
				method,
				headers: this.authorization === null ? {} : { Authorization: this.authorization },
				redirect: 'error',
				signal: AbortSignal.timeout(this.timeoutMs),
			});

			status = response.status;
			body = await response.text();
		} catch {
			throw new Go2rtcApiError(null);
		}

		if ((status < 200 || status >= 300) && !acceptedStatuses.includes(status)) {
			throw new Go2rtcApiError(status);
		}

		return { status, body };
	}
}

function parseObject(body: string, status: number): Record<string, unknown> {
	let parsed: unknown;

	try {
		parsed = JSON.parse(body);
	} catch {
		throw new Go2rtcApiError(status);
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Go2rtcApiError(status);
	}

	return parsed as Record<string, unknown>;
}
