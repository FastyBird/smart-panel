import { createExtensionLogger } from '../../../common/logger';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_MAX_ATTEMPTS,
	PROTECT_MAX_FRAME_BYTES,
	PROTECT_MAX_IMAGE_BYTES,
	PROTECT_MAX_JSON_BYTES,
	PROTECT_REQUEST_DEADLINE_MS,
	PROTECT_REQUEST_TIMEOUT_MS,
	PROTECT_RETRY_BASE_DELAY_MS,
	PROTECT_RTSPS_QUALITIES,
	ProtectEndpoint,
	ProtectRtspsQuality,
	ProtectSubscriptionTopic,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';

import {
	ProtectCamera,
	ProtectCameraFeatureFlags,
	ProtectLight,
	ProtectMetaInfo,
	ProtectNvr,
	ProtectRtspsStreams,
	ProtectSensor,
	ProtectSnapshot,
} from './protect-api.types';
import { buildProtectPath } from './protect-endpoints';
import { NodeProtectTransport, ProtectTransport, ProtectTransportResponse } from './protect-http.transport';
import { ProtectHttpsAgent } from './protect-https-agent';
import { ProtectHeaders, ProtectRatePacer, parseRetryAfterMs, protectSleep } from './protect-rate-pacer';
import { redactProtectText } from './protect-redaction';
import {
	NodeProtectSubscription,
	ProtectSubscription,
	ProtectSubscriptionHandlers,
	protectSubscriptionEndpoint,
} from './protect-subscription';
import { ProtectTlsSettings } from './protect-tls-policy';

export interface ProtectApiClientOptions {
	host: string;
	port: number;
	apiKey: string;
	tls: ProtectTlsSettings;
	timeoutMs?: number;
	deadlineMs?: number;
	maxAttempts?: number;
	/** Tests only (`PROTECT_TRUSTED_CA`). */
	trustedCa?: string | Buffer;
	/** Tests only; the default is a `NodeProtectTransport` over this client's own `ProtectHttpsAgent`. */
	transport?: ProtectTransport;
	pacer?: ProtectRatePacer;
	random?: () => number;
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface ProtectCallOptions {
	signal?: AbortSignal;
}

const RETRY_STATUSES: readonly number[] = [408, 429, 500, 502, 503, 504];
// Creating a stream is idempotent (the body is the union of wanted qualities), but a 5xx may have half-applied.
const STREAM_CREATE_RETRY_STATUSES: readonly number[] = [429];
// A snapshot 503 means the camera cannot deliver one right now; repeating it only queues more work on the console.
const SNAPSHOT_RETRY_STATUSES: readonly number[] = [408, 429];

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const stringArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const protocolError = (endpoint: ProtectEndpoint, status: number | null = null): ProtectApiError =>
	new ProtectApiError(ProtectErrorCategory.PROTOCOL, endpoint, { status });

function parseJson(body: Buffer): unknown {
	try {
		return JSON.parse(body.toString('utf8')) as unknown;
	} catch {
		return undefined;
	}
}

/** Maps a non-2xx answer to a typed error; nothing of the body ever reaches the error. */
export function mapProtectHttpStatus(
	operation: ProtectApiError['operation'],
	status: number,
	headers: ProtectHeaders,
	body: Buffer,
): ProtectApiError {
	const make = (category: ProtectErrorCategory, retryAfterMs: number | null = null): ProtectApiError =>
		new ProtectApiError(category, operation, { status, retryAfterMs });

	switch (status) {
		case 400: {
			const parsed = parseJson(body);

			return operation === 'cameras/{id}/snapshot' &&
				isObject(parsed) &&
				parsed.name === 'BAD_REQUEST' &&
				typeof parsed.error === 'string' &&
				/full hd snapshot/i.test(parsed.error)
				? make(ProtectErrorCategory.UNSUPPORTED)
				: make(ProtectErrorCategory.BAD_REQUEST);
		}
		case 401:
			return make(ProtectErrorCategory.AUTHENTICATION);
		case 403:
			return make(ProtectErrorCategory.AUTHORIZATION);
		case 404:
			return make(ProtectErrorCategory.NOT_FOUND);
		case 408:
			return make(ProtectErrorCategory.TIMEOUT);
		case 429:
			return make(ProtectErrorCategory.RATE_LIMITED, parseRetryAfterMs(headers['retry-after'], Date.now()));
		case 500:
		case 502:
		case 503:
		case 504:
			return make(ProtectErrorCategory.UNAVAILABLE);
		default:
			return make(ProtectErrorCategory.PROTOCOL);
	}
}

function parseFeatureFlags(value: unknown): ProtectCameraFeatureFlags {
	const flags = isObject(value) ? value : {};

	return {
		supportFullHdSnapshot: flags.supportFullHdSnapshot === true,
		hasHdr: flags.hasHdr === true,
		hasMic: flags.hasMic === true,
		hasSpeaker: flags.hasSpeaker === true,
		hasLedStatus: flags.hasLedStatus === true,
		smartDetectTypes: stringArray(flags.smartDetectTypes),
		smartDetectAudioTypes: stringArray(flags.smartDetectAudioTypes),
		videoModes: stringArray(flags.videoModes),
	};
}

/** Null when the entry has no string `id` and `modelKey`; the fixture `guid` is shared by devices and never used. */
function parseDevice(value: unknown): { id: string; modelKey: string; state: string; item: Json } | null {
	if (!isObject(value) || typeof value.id !== 'string' || typeof value.modelKey !== 'string') {
		return null;
	}

	return {
		id: value.id,
		modelKey: value.modelKey,
		state: typeof value.state === 'string' ? value.state : 'UNKNOWN',
		item: value,
	};
}

function parseCamera(value: unknown): ProtectCamera | null {
	const device = parseDevice(value);

	if (device === null) {
		return null;
	}

	const { item } = device;

	return {
		id: device.id,
		modelKey: device.modelKey,
		state: device.state,
		name: stringOrNull(item.name),
		type: stringOrNull(item.type),
		mac: stringOrNull(item.mac),
		hasPackageCamera: item.hasPackageCamera === true,
		featureFlags: parseFeatureFlags(item.featureFlags),
		raw: item,
	};
}

function parseSensor(value: unknown): ProtectSensor | null {
	const device = parseDevice(value);

	return device === null
		? null
		: {
				id: device.id,
				modelKey: device.modelKey,
				state: device.state,
				name: stringOrNull(device.item.name),
				mac: stringOrNull(device.item.mac),
				raw: device.item,
			};
}

function parseLight(value: unknown): ProtectLight | null {
	const device = parseDevice(value);

	return device === null
		? null
		: {
				id: device.id,
				modelKey: device.modelKey,
				state: device.state,
				name: stringOrNull(device.item.name),
				mac: stringOrNull(device.item.mac),
				cameraId: stringOrNull(device.item.camera),
				raw: device.item,
			};
}

function parseRtspsStreams(body: unknown): ProtectRtspsStreams {
	if (!isObject(body)) {
		throw protocolError('cameras/{id}/rtsps-stream');
	}

	return {
		high: stringOrNull(body.high),
		medium: stringOrNull(body.medium),
		low: stringOrNull(body.low),
		package: stringOrNull(body.package),
	};
}

function parseNvr(value: unknown): ProtectNvr | null {
	const candidate: unknown = Array.isArray(value) ? (value[0] as unknown) : value;

	if (!isObject(candidate) || typeof candidate.id !== 'string' || typeof candidate.modelKey !== 'string') {
		return null;
	}

	return {
		id: candidate.id,
		name: stringOrNull(candidate.name),
		modelKey: candidate.modelKey,
		mac: stringOrNull(candidate.mac),
		raw: candidate,
	};
}

/**
 * Client of the Protect Integration API: reads, plus the one stream-creation POST; one retry policy, one rate pacer and one TLS
 * agent per console. The API key is sent as `X-API-KEY` and nowhere else; errors and logs carry endpoint templates,
 * statuses, durations and categories only.
 */
export class ProtectApiClient {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ApiClient');
	private readonly apiKey: string;
	private readonly host: string;
	private readonly port: number;
	private readonly subscriptions = new Set<ProtectSubscription>();
	private readonly timeoutMs: number;
	private readonly deadlineMs: number;
	private readonly maxAttempts: number;
	private readonly transport: ProtectTransport;
	private readonly agent: ProtectHttpsAgent | null;
	private readonly pacer: ProtectRatePacer;
	private readonly random: () => number;
	private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
	private readonly lifetime = new AbortController();

	constructor(options: ProtectApiClientOptions) {
		this.apiKey = options.apiKey;
		this.host = options.host;
		this.port = options.port;
		this.timeoutMs = options.timeoutMs ?? PROTECT_REQUEST_TIMEOUT_MS;
		this.deadlineMs = options.deadlineMs ?? PROTECT_REQUEST_DEADLINE_MS;
		this.maxAttempts = options.maxAttempts ?? PROTECT_MAX_ATTEMPTS;
		this.pacer = options.pacer ?? new ProtectRatePacer();
		this.random = options.random ?? Math.random;
		this.sleep = options.sleep ?? protectSleep;

		if (options.transport) {
			this.agent = null;
			this.transport = options.transport;
		} else {
			// Never shared: a pooled socket must not outlive the host and TLS policy it was verified for.
			this.agent = new ProtectHttpsAgent({
				host: options.host,
				port: options.port,
				tls: options.tls,
				trustedCa: options.trustedCa,
			});
			this.transport = new NodeProtectTransport({ host: options.host, port: options.port, agent: this.agent });
		}
	}

	/** SHA-256 of the leaf the console last presented, or null before the first handshake. */
	get peerFingerprint(): string | null {
		return this.agent?.lastPeerFingerprint ?? null;
	}

	async getMetaInfo(options: ProtectCallOptions = {}): Promise<ProtectMetaInfo> {
		const body = await this.getJson('meta/info', {}, options);

		if (!isObject(body) || typeof body.applicationVersion !== 'string') {
			throw protocolError('meta/info');
		}

		return { applicationVersion: body.applicationVersion };
	}

	async getNvr(options: ProtectCallOptions = {}): Promise<ProtectNvr> {
		const nvr = parseNvr(await this.getJson('nvrs', {}, options));

		if (nvr === null) {
			throw protocolError('nvrs');
		}

		return nvr;
	}

	listCameras(options: ProtectCallOptions = {}): Promise<ProtectCamera[]> {
		return this.getList('cameras', parseCamera, options);
	}

	async getCamera(cameraId: string, options: ProtectCallOptions = {}): Promise<ProtectCamera> {
		const camera = parseCamera(await this.getJson('cameras/{id}', { id: cameraId }, options));

		if (camera === null) {
			throw protocolError('cameras/{id}');
		}

		return camera;
	}

	listSensors(options: ProtectCallOptions = {}): Promise<ProtectSensor[]> {
		return this.getList('sensors', parseSensor, options);
	}

	async getSensor(sensorId: string, options: ProtectCallOptions = {}): Promise<ProtectSensor> {
		const sensor = parseSensor(await this.getJson('sensors/{id}', { id: sensorId }, options));

		if (sensor === null) {
			throw protocolError('sensors/{id}');
		}

		return sensor;
	}

	listLights(options: ProtectCallOptions = {}): Promise<ProtectLight[]> {
		return this.getList('lights', parseLight, options);
	}

	async getLight(lightId: string, options: ProtectCallOptions = {}): Promise<ProtectLight> {
		const light = parseLight(await this.getJson('lights/{id}', { id: lightId }, options));

		if (light === null) {
			throw protocolError('lights/{id}');
		}

		return light;
	}

	async getRtspsStreams(cameraId: string, options: ProtectCallOptions = {}): Promise<ProtectRtspsStreams> {
		return parseRtspsStreams(await this.getJson('cameras/{id}/rtsps-stream', { id: cameraId }, options));
	}

	/**
	 * The client's only write. SECRET result: the URLs carry bearer aliases. The qualities are validated before any
	 * request; the body lists them in the given order.
	 */
	async createRtspsStreams(
		cameraId: string,
		qualities: readonly ProtectRtspsQuality[],
		options: ProtectCallOptions = {},
	): Promise<ProtectRtspsStreams> {
		const endpoint = 'cameras/{id}/rtsps-stream';

		if (
			qualities.length === 0 ||
			new Set(qualities).size !== qualities.length ||
			!qualities.every((quality) => (PROTECT_RTSPS_QUALITIES as readonly string[]).includes(quality))
		) {
			throw new ProtectApiError(ProtectErrorCategory.VALIDATION, endpoint);
		}

		const response = await this.execute(
			endpoint,
			{ id: cameraId },
			{
				method: 'POST',
				body: Buffer.from(JSON.stringify({ qualities })),
				accept: 'application/json',
				maxBytes: PROTECT_MAX_JSON_BYTES,
				retryStatuses: STREAM_CREATE_RETRY_STATUSES,
			},
			options,
		);
		const parsed = parseJson(response.body);

		if (parsed === undefined) {
			throw protocolError(endpoint, response.status);
		}

		return parseRtspsStreams(parsed);
	}

	async getSnapshot(
		cameraId: string,
		options: ProtectCallOptions & { highQuality?: boolean; channel?: 'main' | 'package' } = {},
	): Promise<ProtectSnapshot> {
		const query: Record<string, string> = {};

		if (options.highQuality !== undefined) {
			query.highQuality = String(options.highQuality);
		}

		if (options.channel !== undefined) {
			query.channel = options.channel;
		}

		const response = await this.execute(
			'cameras/{id}/snapshot',
			{ id: cameraId, query },
			{
				method: 'GET',
				accept: 'image/jpeg',
				maxBytes: PROTECT_MAX_IMAGE_BYTES,
				retryStatuses: SNAPSHOT_RETRY_STATUSES,
			},
			options,
		);
		const contentType = response.headers['content-type'];
		const mediaType = (Array.isArray(contentType) ? contentType[0] : contentType)?.split(';')[0].trim().toLowerCase();

		if (mediaType === undefined || !mediaType.startsWith('image/') || response.body.length === 0) {
			throw protocolError('cameras/{id}/snapshot', response.status);
		}

		return { contentType: mediaType, data: response.body };
	}

	/**
	 * Opens one of the two console WebSockets through this client's verified TLS agent, API key and pacer (one slot
	 * per upgrade). Resolves once the upgrade succeeded; the failure operation is the endpoint template.
	 */
	async openSubscription(
		topic: ProtectSubscriptionTopic,
		handlers: ProtectSubscriptionHandlers,
		options: ProtectCallOptions = {},
	): Promise<ProtectSubscription> {
		const endpoint = protectSubscriptionEndpoint(topic);
		const cancelled = new ProtectApiError(ProtectErrorCategory.CANCELLED, endpoint);
		const signal = options.signal ? AbortSignal.any([this.lifetime.signal, options.signal]) : this.lifetime.signal;

		if (signal.aborted) {
			throw cancelled;
		}

		if (this.agent === null) {
			throw new ProtectApiError(ProtectErrorCategory.VALIDATION, endpoint);
		}

		const url = `wss://${this.host.includes(':') && !this.host.startsWith('[') ? `[${this.host}]` : this.host}:${this.port}${buildProtectPath(endpoint)}`;
		const startedAt = Date.now();

		try {
			await this.pacer.acquire(signal);

			const subscription = await NodeProtectSubscription.open({
				url,
				topic,
				agent: this.agent,
				apiKey: this.apiKey,
				handshakeTimeoutMs: this.timeoutMs,
				maxPayload: PROTECT_MAX_FRAME_BYTES,
				signal,
				handlers,
				onRejected: (status, headers) => {
					this.pacer.observe(headers);

					const failure = mapProtectHttpStatus(endpoint, status, headers, Buffer.alloc(0));

					if (status === 429) {
						this.pacer.backOff(failure.retryAfterMs ?? PROTECT_RETRY_BASE_DELAY_MS);
					}

					return failure;
				},
				debug: (message) => this.logger.debug(redactProtectText(message, [this.apiKey])),
				ended: (ended) => this.subscriptions.delete(ended),
			});

			if (this.lifetime.signal.aborted) {
				subscription.close();

				throw cancelled;
			}

			if (subscription.isSettled) {
				// Ended between the upgrade and this continuation (for example an oversized first frame): never register it.
				throw new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, endpoint);
			}

			this.subscriptions.add(subscription);
			this.logger.debug(redactProtectText(`WS ${endpoint} open ${Date.now() - startedAt}ms`, [this.apiKey]));

			return subscription;
		} catch (error) {
			const failure = signal.aborted ? cancelled : this.withOperation(error, endpoint);

			this.logger.debug(redactProtectText(`WS ${endpoint} failed (${failure.category})`, [this.apiKey]));

			throw failure;
		}
	}

	/** In-flight and later calls reject with `cancelled`; open subscriptions are terminated without `closed`. */
	close(): void {
		this.lifetime.abort();
		[...this.subscriptions].forEach((subscription) => subscription.close());
		this.subscriptions.clear();
		this.transport.close();
	}

	private async getJson(
		endpoint: ProtectEndpoint,
		params: { id?: string; query?: Record<string, string> },
		options: ProtectCallOptions,
	): Promise<unknown> {
		const response = await this.execute(
			endpoint,
			params,
			{ method: 'GET', accept: 'application/json', maxBytes: PROTECT_MAX_JSON_BYTES, retryStatuses: RETRY_STATUSES },
			options,
		);
		const parsed = parseJson(response.body);

		if (parsed === undefined) {
			throw protocolError(endpoint, response.status);
		}

		return parsed;
	}

	private async getList<T>(
		endpoint: ProtectEndpoint,
		parse: (value: unknown) => T | null,
		options: ProtectCallOptions,
	): Promise<T[]> {
		const body = await this.getJson(endpoint, {}, options);

		if (!Array.isArray(body)) {
			throw protocolError(endpoint);
		}

		const items = body.map(parse).filter((item): item is T => item !== null);

		if (items.length < body.length) {
			this.logger.debug(`GET ${endpoint} dropped ${body.length - items.length} entries without id or modelKey`);
		}

		return items;
	}

	/** One call: pace, request, observe, retry per the policy, map the outcome. Returns only 2xx answers. */
	private async execute(
		endpoint: ProtectEndpoint,
		params: { id?: string; query?: Record<string, string> },
		request: {
			method: 'GET' | 'POST';
			body?: Buffer;
			accept: string;
			maxBytes: number;
			retryStatuses: readonly number[];
		},
		options: ProtectCallOptions,
	): Promise<ProtectTransportResponse> {
		const cancelled = new ProtectApiError(ProtectErrorCategory.CANCELLED, endpoint);
		const signal = options.signal ? AbortSignal.any([this.lifetime.signal, options.signal]) : this.lifetime.signal;

		if (signal.aborted) {
			throw cancelled;
		}

		const path = buildProtectPath(endpoint, params);
		const startedAt = Date.now();
		const deadlineAt = startedAt + this.deadlineMs;
		const timedOut = new ProtectApiError(ProtectErrorCategory.TIMEOUT, endpoint);

		// The deadline covers the whole call, so a long pacing pause or retry sleep ends it on time instead of after.
		const deadline = new AbortController();
		const deadlineTimer = setTimeout(() => deadline.abort(timedOut), this.deadlineMs);

		deadlineTimer.unref();

		// Closing the client, the caller's signal and the deadline all reach the pacer and the sleeps, so their timers
		// stop with the call; the race below decides which error the call ends with.
		const waitSignal = AbortSignal.any([signal, deadline.signal]);
		const guarded = <T>(promise: Promise<T>): Promise<T> =>
			new Promise<T>((resolve, reject) => {
				const onAbort = (): void => reject(cancelled);
				const onDeadline = (): void => reject(timedOut);

				signal.addEventListener('abort', onAbort, { once: true });
				deadline.signal.addEventListener('abort', onDeadline, { once: true });
				promise.then(resolve, reject).finally(() => {
					signal.removeEventListener('abort', onAbort);
					deadline.signal.removeEventListener('abort', onDeadline);
				});
			});

		try {
			for (let attempt = 1; ; attempt++) {
				await guarded(this.pacer.acquire(waitSignal));

				// The pacer may have held this call past its overall deadline; do not send what nobody awaits anymore.
				if (Date.now() >= deadlineAt) {
					throw new ProtectApiError(ProtectErrorCategory.TIMEOUT, endpoint);
				}

				const attemptStartedAt = Date.now();
				let response: ProtectTransportResponse;

				try {
					response = await this.transport.request({
						method: request.method,
						path,
						headers: { 'X-API-KEY': this.apiKey, Accept: request.accept },
						timeoutMs: Math.max(1, Math.min(this.timeoutMs, deadlineAt - attemptStartedAt)),
						maxBytes: request.maxBytes,
						signal,
						body: request.body,
					});
				} catch (error) {
					if (signal.aborted) {
						throw cancelled;
					}

					// A pooled keep-alive socket the console already closed: one immediate retry on a fresh socket.
					if (attempt === 1 && (error as { code?: unknown } | null)?.code === 'ECONNRESET') {
						this.logger.debug(`${request.method} ${endpoint} connection reset, retrying once`);

						continue;
					}

					throw this.withOperation(error, endpoint);
				}

				this.pacer.observe(response.headers);
				this.log(request.method, endpoint, response.status, Date.now() - attemptStartedAt);

				if (response.status >= 200 && response.status < 300) {
					return response;
				}

				const failure = mapProtectHttpStatus(endpoint, response.status, response.headers, response.body);
				const retryAfterMs = parseRetryAfterMs(response.headers['retry-after'], Date.now());
				const delay =
					retryAfterMs ?? Math.round(PROTECT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) * (0.8 + this.random() * 0.4));

				if (response.status === 429) {
					this.pacer.backOff(delay);
				}

				if (
					!request.retryStatuses.includes(response.status) ||
					attempt >= this.maxAttempts ||
					Date.now() + delay > deadlineAt
				) {
					throw failure;
				}

				await guarded(this.sleep(delay, waitSignal));
			}
		} catch (error) {
			if (signal.aborted) {
				throw cancelled;
			}

			throw error;
		} finally {
			clearTimeout(deadlineTimer);
		}
	}

	/** Keeps the category of an already typed failure and sanitizes anything else, whatever the transport threw. */
	private withOperation(error: unknown, endpoint: ProtectEndpoint): ProtectApiError {
		const typed = toProtectApiError(error, endpoint);

		return typed.operation === endpoint
			? typed
			: new ProtectApiError(typed.category, endpoint, { status: typed.status, retryAfterMs: typed.retryAfterMs });
	}

	private log(method: string, endpoint: ProtectEndpoint, status: number, durationMs: number): void {
		this.logger.debug(redactProtectText(`${method} ${endpoint} ${status} ${durationMs}ms`, [this.apiKey]));
	}
}
