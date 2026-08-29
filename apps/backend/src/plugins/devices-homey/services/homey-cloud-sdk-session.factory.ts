import { Injectable } from '@nestjs/common';

import { HomeyCloudProviderClient, HomeySdkClient, HomeySdkClientFactoryService } from '../connectors/homey-sdk.client';
import { HOMEY_CLOUD_TOKEN_REFRESH_SKEW_MS } from '../devices-homey.constants';
import {
	HomeyCloudConfigurationError,
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
	HomeyCloudSelectionError,
} from '../errors/homey-cloud-authorization.error';
import { HomeyCloudGrantConflictError, HomeyCloudGrantStateError } from '../errors/homey-cloud-grant.error';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import {
	HomeyCloudActiveGrantCredentials,
	HomeyCloudGrantMutationService,
	HomeyCloudTokenMaterial,
} from './homey-cloud-grant-mutation.service';
import { runHomeyCloudProviderOperation } from './homey-cloud-provider-operation';
import { homeyCloudTokenRequiresRefresh, normalizeHomeyCloudToken } from './homey-cloud-token';

export interface HomeyCloudSdkSessionFactory {
	createClient(): Promise<HomeySdkClient>;
}

interface HomeyCloudRefreshOperation {
	readonly generation: number;
	readonly grantIdentifier: string;
	readonly promise: Promise<HomeyCloudActiveGrantCredentials>;
}

@Injectable()
export class HomeyCloudSdkSessionFactoryService implements HomeyCloudSdkSessionFactory {
	private refreshOperation: HomeyCloudRefreshOperation | null = null;

	constructor(
		private readonly clientConfig: HomeyCloudClientConfigService,
		private readonly sdkClientFactory: HomeySdkClientFactoryService,
		private readonly grantMutations: HomeyCloudGrantMutationService,
	) {}

	async createClient(): Promise<HomeySdkClient> {
		try {
			let credentials = await this.loadActiveCredentials();
			let refreshed = false;

			if (homeyCloudTokenRequiresRefresh(credentials.token, Date.now(), HOMEY_CLOUD_TOKEN_REFRESH_SKEW_MS)) {
				credentials = await this.refresh(credentials);
				refreshed = true;
			}

			try {
				return await this.authenticate(credentials);
			} catch (error) {
				if (refreshed || !this.isInvalidToken(error) || credentials.token.refreshToken === null) throw error;

				return await this.authenticate(await this.refresh(credentials));
			}
		} catch (error) {
			throw this.toConnectorError(error);
		}
	}

	private async loadActiveCredentials(): Promise<HomeyCloudActiveGrantCredentials> {
		const credentials = await this.grantMutations.loadActiveGrantCredentials();

		if (credentials === null) {
			throw new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.CONNECT);
		}

		return credentials;
	}

	private async authenticate(credentials: HomeyCloudActiveGrantCredentials): Promise<HomeySdkClient> {
		const provider = this.createProvider(credentials.token);
		const client = await runHomeyCloudProviderOperation(HomeyCloudProviderOperation.AUTHENTICATE_HOMEY, (signal) =>
			provider.createHomeyClient(credentials.selectedHomeyId, signal, false),
		);

		if (!this.isSdkClient(client)) {
			await this.disposeInvalidClient(client);
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.PROTOCOL,
				HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
			);
		}

		return client;
	}

	private refresh(credentials: HomeyCloudActiveGrantCredentials): Promise<HomeyCloudActiveGrantCredentials> {
		if (
			this.refreshOperation?.grantIdentifier === credentials.grantIdentifier &&
			this.refreshOperation.generation === credentials.generation
		) {
			return this.refreshOperation.promise;
		}

		const operation: HomeyCloudRefreshOperation = {
			generation: credentials.generation,
			grantIdentifier: credentials.grantIdentifier,
			promise: this.performRefresh(credentials),
		};
		this.refreshOperation = operation;

		void operation.promise.then(
			() => {
				if (this.refreshOperation === operation) this.refreshOperation = null;
			},
			() => {
				if (this.refreshOperation === operation) this.refreshOperation = null;
			},
		);

		return operation.promise;
	}

	private async performRefresh(
		credentials: HomeyCloudActiveGrantCredentials,
	): Promise<HomeyCloudActiveGrantCredentials> {
		const refreshToken = credentials.token.refreshToken;

		if (refreshToken === null) {
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				HomeyCloudProviderOperation.REFRESH_TOKEN,
			);
		}

		const provider = this.createProvider(credentials.token);
		const issuedAt = Date.now();
		const response = await runHomeyCloudProviderOperation(HomeyCloudProviderOperation.REFRESH_TOKEN, (signal) =>
			provider.refreshAccessToken(refreshToken, signal),
		);
		const token = normalizeHomeyCloudToken(response, issuedAt, HomeyCloudProviderOperation.REFRESH_TOKEN, {
			grantType: credentials.token.grantType,
			refreshToken,
		});
		const persisted = await this.grantMutations.persistRefresh({
			configurationGeneration: credentials.configurationGeneration,
			generation: credentials.generation,
			grantIdentifier: credentials.grantIdentifier,
			token,
		});

		if (persisted !== null) return { ...persisted, token };

		return this.loadActiveCredentials();
	}

	private createProvider(token: HomeyCloudTokenMaterial): HomeyCloudProviderClient {
		return this.sdkClientFactory.createCloudProviderClient({
			...this.clientConfig.getConfiguration(),
			token,
		});
	}

	private isInvalidToken(error: unknown): boolean {
		return error instanceof HomeyCloudProviderError && error.category === HomeyCloudProviderErrorCategory.INVALID_TOKEN;
	}

	private isSdkClient(value: unknown): value is HomeySdkClient {
		if (!this.isRecord(value)) return false;

		const devices = value.devices;
		const system = value.system;
		const zones = value.zones;

		return (
			this.isRecord(devices) &&
			this.hasFunctions(devices, ['connect', 'disconnect', 'getDevice', 'getDevices', 'on', 'setCapabilityValue']) &&
			this.isRecord(system) &&
			this.hasFunctions(system, ['getInfo']) &&
			this.isRecord(zones) &&
			this.hasFunctions(zones, ['connect', 'disconnect', 'getZones', 'on']) &&
			this.hasFunctions(value, ['destroy', 'disconnect'])
		);
	}

	private async disposeInvalidClient(value: unknown): Promise<void> {
		if (!this.isRecord(value)) return;
		const disconnect = value.disconnect;
		const destroy = value.destroy;

		try {
			if (this.isFunction(disconnect)) await Promise.resolve(disconnect.call(value));
		} catch {
			// The sanitized protocol error remains authoritative.
		}

		try {
			if (this.isFunction(destroy)) destroy.call(value);
		} catch {
			// The sanitized protocol error remains authoritative.
		}
	}

	private hasFunctions(value: Record<string, unknown>, names: readonly string[]): boolean {
		return names.every((name) => this.isFunction(value[name]));
	}

	private isFunction(value: unknown): value is () => unknown {
		return typeof value === 'function';
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	private toConnectorError(error: unknown): HomeyConnectorError {
		if (error instanceof HomeyConnectorError) {
			return new HomeyConnectorError(error.category, HomeyConnectorOperation.CONNECT);
		}
		if (error instanceof HomeyCloudConfigurationError) {
			return new HomeyConnectorError(HomeyConnectorErrorCategory.VALIDATION, HomeyConnectorOperation.CONNECT);
		}
		if (
			error instanceof HomeyCloudGrantConflictError ||
			error instanceof HomeyCloudGrantStateError ||
			error instanceof HomeyCloudSelectionError
		) {
			return new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.CONNECT);
		}
		if (error instanceof HomeyCloudProviderError) {
			return new HomeyConnectorError(this.providerConnectorCategory(error.category), HomeyConnectorOperation.CONNECT);
		}

		return new HomeyConnectorError(HomeyConnectorErrorCategory.PROTOCOL, HomeyConnectorOperation.CONNECT);
	}

	private providerConnectorCategory(category: HomeyCloudProviderErrorCategory): HomeyConnectorErrorCategory {
		switch (category) {
			case HomeyCloudProviderErrorCategory.INVALID_GRANT:
			case HomeyCloudProviderErrorCategory.INVALID_TOKEN:
			case HomeyCloudProviderErrorCategory.NO_ELIGIBLE_HOMEYS:
				return HomeyConnectorErrorCategory.AUTHENTICATION;
			case HomeyCloudProviderErrorCategory.TIMEOUT:
				return HomeyConnectorErrorCategory.TIMEOUT;
			case HomeyCloudProviderErrorCategory.RATE_LIMITED:
			case HomeyCloudProviderErrorCategory.UNAVAILABLE:
				return HomeyConnectorErrorCategory.UNAVAILABLE;
			case HomeyCloudProviderErrorCategory.PROTOCOL:
				return HomeyConnectorErrorCategory.PROTOCOL;
		}
	}
}
