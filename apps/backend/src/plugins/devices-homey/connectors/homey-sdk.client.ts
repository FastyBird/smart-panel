import { AthomCloudAPI, HomeyAPI } from 'homey-api';

import { Injectable } from '@nestjs/common';

import { HOMEY_CLOUD_AUTHORIZE_URL } from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';

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
	authenticateHomey(homeyId: string): Promise<void>;
	exchangeAuthorizationCode(code: string): Promise<HomeyCloudProviderTokenResponse>;
	getHomeys(): Promise<readonly HomeyCloudProviderHomey[]>;
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

		return new HomeyCloudProviderSdkClient(cloudApi);
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
}

class HomeyCloudProviderSdkClient implements HomeyCloudProviderClient {
	constructor(private readonly cloudApi: AthomCloudAPI) {}

	async exchangeAuthorizationCode(code: string): Promise<HomeyCloudProviderTokenResponse> {
		return this.cloudApi.authenticateWithAuthorizationCode({ code, removeCodeFromHistory: false });
	}

	async getHomeys(): Promise<readonly HomeyCloudProviderHomey[]> {
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
	}

	async authenticateHomey(homeyId: string): Promise<void> {
		const user = await this.getAuthenticatedUserFresh();
		const homey = user.getHomeyById(homeyId) as unknown as {
			authenticate(options: { reconnect: boolean; strategy: string }): Promise<HomeySdkClient>;
		};
		const homeyApi = await homey.authenticate({ strategy: 'cloud', reconnect: false });

		try {
			await homeyApi.disconnect();
		} finally {
			homeyApi.destroy();
		}
	}

	private getAuthenticatedUserFresh(): Promise<AthomCloudAPI.User> {
		const cloudApi = this.cloudApi as unknown as {
			getAuthenticatedUser(options: { $cache: boolean }): Promise<AthomCloudAPI.User>;
		};

		return cloudApi.getAuthenticatedUser({ $cache: false });
	}
}
