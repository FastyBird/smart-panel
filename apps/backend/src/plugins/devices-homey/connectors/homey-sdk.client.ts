import { AthomCloudAPI, HomeyAPI } from 'homey-api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';

import { Injectable } from '@nestjs/common';

import {
	HOMEY_CLOUD_API_URL,
	HOMEY_CLOUD_AUTHORIZE_URL,
	HOMEY_CLOUD_HOMEY_HOST_SUFFIX,
	HOMEY_CLOUD_PROVIDER_TIMEOUT_MS,
	HOMEY_CLOUD_TOKEN_URL,
} from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';

const homeySdkAbortContext = installHomeySdkAbortBridge();

export type HomeySdkEventListener = (...arguments_: unknown[]) => Promise<void> | void;

export interface HomeySdkEventSource {
	on(event: string, listener: HomeySdkEventListener): unknown;
	off?(event: string, listener: HomeySdkEventListener): unknown;
}

export interface HomeySdkOperationOptions {
	readonly $cache?: boolean;
	readonly $timeout?: number;
	readonly $updateCache?: boolean;
}

export interface HomeySdkDevice extends HomeySdkEventSource {
	readonly id: string;
	readonly available?: unknown;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}

export interface HomeySdkDevicesManager extends HomeySdkEventSource {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getDevices(options?: HomeySdkOperationOptions): Promise<Record<string, HomeySdkDevice>>;
	getDevice(options: HomeySdkOperationOptions & { id: string }): Promise<HomeySdkDevice>;
	setCapabilityValue(
		options: HomeySdkOperationOptions & {
			capabilityId: string;
			deviceId: string;
			value: unknown;
		},
	): Promise<unknown>;
}

export interface HomeySdkZonesManager extends HomeySdkEventSource {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getZones(options?: HomeySdkOperationOptions): Promise<Record<string, unknown>>;
}

export interface HomeySdkSystemManager {
	getInfo(options?: HomeySdkOperationOptions): Promise<unknown>;
}

export interface HomeySdkClient {
	readonly id: string | null;
	readonly name: string | null;
	readonly version: string | null;
	readonly devices: HomeySdkDevicesManager;
	readonly system: HomeySdkSystemManager;
	readonly zones: HomeySdkZonesManager;
	disconnect(): Promise<void>;
	destroy(): void;
}

export interface HomeySdkClientFactory {
	createLocalApi(options: { address: string; token: string }): Promise<HomeySdkClient>;
}

export interface HomeyCloudSdkClientFactory {
	createCloudAuthorizationUrl(options: {
		clientId: string;
		clientSecret: string;
		redirectUrl: string;
		scopes: string[];
		state: string;
	}): string;
	createCloudProviderClient(options: {
		clientId: string;
		clientSecret: string;
		redirectUrl: string;
		token?: HomeyCloudProviderToken;
	}): HomeyCloudProviderClient;
}

export interface HomeyCloudProviderToken {
	readonly accessToken: string;
	readonly expiresIn: number | null;
	readonly grantType: string | null;
	readonly refreshToken: string | null;
	readonly tokenType: string;
}

export interface HomeyCloudProviderTokenResponse {
	readonly access_token?: unknown;
	readonly expires_in?: unknown;
	readonly grant_type?: unknown;
	readonly refresh_token?: unknown;
	readonly token_type?: unknown;
}

export interface HomeyCloudProviderHomey {
	readonly apiVersion: unknown;
	readonly id: unknown;
	readonly name: unknown;
	readonly platform: unknown;
}

export interface HomeyCloudProviderClient {
	authenticateHomey(homeyId: string, signal: AbortSignal): Promise<void>;
	exchangeAuthorizationCode(code: string, signal: AbortSignal): Promise<HomeyCloudProviderTokenResponse>;
	getHomeys(signal: AbortSignal): Promise<readonly HomeyCloudProviderHomey[]>;
}

@Injectable()
export class HomeySdkClientFactoryService implements HomeySdkClientFactory, HomeyCloudSdkClientFactory {
	async createLocalApi(options: { address: string; token: string }): Promise<HomeySdkClient> {
		return (await HomeyAPI.createLocalAPI({
			address: options.address,
			token: options.token,
			debug: null,
		})) as HomeySdkClient;
	}

	createCloudAuthorizationUrl(options: {
		clientId: string;
		clientSecret: string;
		redirectUrl: string;
		scopes: string[];
		state: string;
	}): string {
		const cloudApi = new AthomCloudAPI({
			clientId: options.clientId,
			clientSecret: options.clientSecret,
			redirectUrl: options.redirectUrl,
			autoRefreshTokens: false,
		});
		const authorizeUrl = cloudApi.getLoginUrl({ state: options.state, scopes: options.scopes });

		this.assertCloudAuthorizationEndpoint(authorizeUrl);

		return authorizeUrl;
	}

	createCloudProviderClient(options: {
		clientId: string;
		clientSecret: string;
		redirectUrl: string;
		token?: HomeyCloudProviderToken;
	}): HomeyCloudProviderClient {
		const TokenConstructor = AthomCloudAPI.Token as unknown as new (properties: {
			access_token: string;
			expires_in?: number;
			grant_type?: string;
			refresh_token?: string;
			token_type: string;
		}) => AthomCloudAPI.Token;
		const token = options.token
			? new TokenConstructor({
					token_type: options.token.tokenType,
					access_token: options.token.accessToken,
					refresh_token: options.token.refreshToken ?? undefined,
					expires_in: options.token.expiresIn ?? undefined,
					grant_type: options.token.grantType ?? undefined,
				})
			: undefined;
		const cloudApi = new AthomCloudAPI({
			clientId: options.clientId,
			clientSecret: options.clientSecret,
			redirectUrl: options.redirectUrl,
			autoRefreshTokens: false,
			token,
		});
		const cloudApiBaseUrl = (cloudApi as unknown as { baseUrl: unknown }).baseUrl;

		this.assertCloudApiEndpoint(cloudApiBaseUrl);

		return new HomeyCloudProviderSdkClient(cloudApi, options.clientId, options.clientSecret);
	}

	private assertCloudAuthorizationEndpoint(value: string): void {
		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new HomeyCloudConfigurationError('Homey Cloud authorization endpoint is invalid');
		}

		if (url.username || url.password || url.origin + url.pathname !== HOMEY_CLOUD_AUTHORIZE_URL) {
			throw new HomeyCloudConfigurationError('Homey Cloud authorization endpoint is invalid');
		}
	}

	private assertCloudApiEndpoint(value: unknown): void {
		if (typeof value !== 'string') {
			throw new HomeyCloudConfigurationError('Homey Cloud provider endpoint is invalid');
		}

		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new HomeyCloudConfigurationError('Homey Cloud provider endpoint is invalid');
		}

		if (
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			url.origin + url.pathname !== HOMEY_CLOUD_API_URL + '/'
		) {
			throw new HomeyCloudConfigurationError('Homey Cloud provider endpoint is invalid');
		}
	}
}

class HomeyCloudProviderSdkClient implements HomeyCloudProviderClient {
	private activeSignal: AbortSignal | null = null;

	constructor(
		private readonly cloudApi: AthomCloudAPI,
		private readonly clientId: string,
		private readonly clientSecret: string,
	) {
		const cloudApiExecutor = this.cloudApi as unknown as HomeyCloudApiExecutor;

		cloudApiExecutor.onCallRequestExecute = ({ request }) => this.executeSdkRequest(request);
	}

	async exchangeAuthorizationCode(code: string, signal: AbortSignal): Promise<HomeyCloudProviderTokenResponse> {
		const response = await this.executeFetch(
			HOMEY_CLOUD_TOKEN_URL,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ grant_type: 'authorization_code', code }),
				redirect: 'error',
			},
			signal,
			HOMEY_CLOUD_PROVIDER_TIMEOUT_MS,
		);
		let body: unknown;

		if (!response.ok) throw new HomeyCloudSdkHttpError(response.status);

		try {
			body = await response.json();
		} catch {
			if (signal.aborted) throw new HomeyCloudSdkAbortError();

			throw new HomeyCloudSdkProtocolError();
		}

		if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HomeyCloudSdkProtocolError();

		return body as HomeyCloudProviderTokenResponse;
	}

	async getHomeys(signal: AbortSignal): Promise<readonly HomeyCloudProviderHomey[]> {
		return this.withSignal(signal, async () => {
			const user = await this.getAuthenticatedUserFresh();

			return user.getHomeys().map((homey) => {
				const properties = homey as unknown as Record<string, unknown>;

				return {
					id: homey.id,
					name: properties.name,
					apiVersion: properties.apiVersion,
					platform: properties.platform,
				};
			});
		});
	}

	async authenticateHomey(homeyId: string, signal: AbortSignal): Promise<void> {
		return this.withSignal(signal, async () => {
			const user = await this.getAuthenticatedUserFresh();
			const homey = user.getHomeyById(homeyId) as unknown as {
				authenticate(options: { reconnect: boolean; strategy: string }): Promise<HomeySdkClient>;
				remoteUrl?: unknown;
			};

			this.assertHomeyCloudEndpoint(homey.remoteUrl);

			const homeyApi = await homey.authenticate({ strategy: 'cloud', reconnect: false });

			try {
				await homeyApi.disconnect();
			} finally {
				homeyApi.destroy();
			}
		});
	}

	private getAuthenticatedUserFresh(): Promise<AthomCloudAPI.User> {
		const cloudApi = this.cloudApi as unknown as {
			getAuthenticatedUser(options: { $cache: boolean }): Promise<AthomCloudAPI.User>;
		};

		return cloudApi.getAuthenticatedUser({ $cache: false });
	}

	private async withSignal<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
		if (signal.aborted) throw new HomeyCloudSdkAbortError();
		if (this.activeSignal) throw new HomeyCloudSdkProtocolError();

		this.activeSignal = signal;

		try {
			return await homeySdkAbortContext.run(signal, operation);
		} catch (error) {
			if (signal.aborted) throw new HomeyCloudSdkAbortError();

			throw error;
		} finally {
			this.activeSignal = null;
		}
	}

	private executeSdkRequest(request: HomeyCloudSdkRequest): Promise<Response> {
		this.assertProviderRequestUrl(request.url);

		return this.executeFetch(
			request.url,
			{
				method: request.method,
				headers: request.headers,
				body: request.body,
				redirect: 'error',
			},
			this.activeSignal,
			request.timeout ?? HOMEY_CLOUD_PROVIDER_TIMEOUT_MS,
		);
	}

	private async executeFetch(
		url: string,
		options: RequestInit,
		externalSignal: AbortSignal | null,
		timeoutMs: number,
	): Promise<Response> {
		const timeoutSignal = AbortSignal.timeout(timeoutMs);
		const signal = externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;

		try {
			return await fetch(url, { ...options, signal });
		} catch (error) {
			if (timeoutSignal.aborted) throw new HomeyCloudSdkTimeoutError();
			if (externalSignal?.aborted) throw new HomeyCloudSdkAbortError();

			throw error;
		}
	}

	private assertProviderRequestUrl(value: string): void {
		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new HomeyCloudSdkProtocolError();
		}

		if (url.username || url.password || url.origin !== HOMEY_CLOUD_API_URL) throw new HomeyCloudSdkProtocolError();
	}

	private assertHomeyCloudEndpoint(value: unknown): void {
		if (typeof value !== 'string') throw new HomeyCloudSdkProtocolError();

		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new HomeyCloudSdkProtocolError();
		}

		const homeyHost = url.hostname.endsWith(HOMEY_CLOUD_HOMEY_HOST_SUFFIX)
			? url.hostname.slice(0, -HOMEY_CLOUD_HOMEY_HOST_SUFFIX.length)
			: '';

		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.port ||
			url.pathname !== '/' ||
			url.search ||
			url.hash ||
			!this.isDnsLabel(homeyHost)
		) {
			throw new HomeyCloudSdkProtocolError();
		}
	}

	private isDnsLabel(value: string): boolean {
		return /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/iu.test(value);
	}
}

interface HomeyCloudSdkRequest {
	readonly body?: BodyInit;
	readonly headers: HeadersInit;
	readonly method: string;
	readonly timeout?: number;
	readonly url: string;
}

interface HomeyCloudApiExecutor {
	baseUrl: string;
	onCallRequestExecute(input: { request: HomeyCloudSdkRequest }): Promise<Response>;
}

interface HomeySdkUtility {
	readonly fastyBirdAbortContext?: AsyncLocalStorage<AbortSignal>;
	fetch: (
		url: string,
		options?: RequestInit,
		timeoutDuration?: number,
		timeoutMessage?: string,
		patchOptions?: (options: RequestInit, url: string) => RequestInit | void,
	) => Promise<Response>;
}

function installHomeySdkAbortBridge(): AsyncLocalStorage<AbortSignal> {
	const loadModule = createRequire(__filename) as (moduleId: string) => unknown;
	const homeyApiModule = loadModule('homey-api') as { Util: HomeySdkUtility };
	const utility = homeyApiModule.Util;

	if (utility.fastyBirdAbortContext) return utility.fastyBirdAbortContext;

	const context = new AsyncLocalStorage<AbortSignal>();
	const originalFetch = utility.fetch.bind(utility) as HomeySdkUtility['fetch'];

	utility.fetch = (url, options = {}, _timeoutDuration, _timeoutMessage, patchOptions) => {
		const operationSignal = context.getStore();

		if (!operationSignal) return originalFetch(url, options, _timeoutDuration, _timeoutMessage, patchOptions);

		const existingSignal = options.signal;
		const signal = existingSignal ? AbortSignal.any([existingSignal, operationSignal]) : operationSignal;

		// The provider service owns the complete-operation deadline. Do not let the SDK replace the operation signal with a
		// headers-only timeout controller that is detached before its response body has been consumed.
		return originalFetch(url, { ...options, redirect: 'error', signal }, undefined, undefined, patchOptions);
	};
	Object.defineProperty(utility, 'fastyBirdAbortContext', {
		configurable: false,
		enumerable: false,
		value: context,
		writable: false,
	});

	return context;
}

class HomeyCloudSdkHttpError extends Error {
	readonly statusCode: number;

	constructor(statusCode: number) {
		super('Homey Cloud provider request failed');
		this.name = 'HomeyCloudSdkHttpError';
		this.statusCode = statusCode;
	}
}

class HomeyCloudSdkProtocolError extends Error {
	constructor() {
		super('Homey Cloud provider response is invalid');
		this.name = 'HomeyCloudSdkProtocolError';
	}
}

class HomeyCloudSdkAbortError extends Error {
	readonly code = 'ABORTERROR';

	constructor() {
		super('Homey Cloud provider request was aborted');
		this.name = 'HomeyCloudSdkAbortError';
	}
}

class HomeyCloudSdkTimeoutError extends Error {
	readonly statusCode = 408;

	constructor() {
		super('Homey Cloud provider request timed out');
		this.name = 'HomeyCloudSdkTimeoutError';
	}
}
