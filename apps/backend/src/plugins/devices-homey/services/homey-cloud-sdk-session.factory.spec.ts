import { HomeyCloudProviderClient, HomeySdkClient, HomeySdkClientFactoryService } from '../connectors/homey-sdk.client';
import { HOMEY_CLOUD_PROVIDER_TIMEOUT_MS, HOMEY_CLOUD_TOKEN_REFRESH_SKEW_MS } from '../devices-homey.constants';
import {
	HomeyCloudConfigurationError,
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
} from '../errors/homey-cloud-authorization.error';
import { HomeyConnectorErrorCategory, HomeyConnectorOperation } from '../errors/homey-connector.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import { HomeyCloudActiveGrantCredentials, HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';
import { HomeyCloudSdkSessionFactoryService } from './homey-cloud-sdk-session.factory';

describe('HomeyCloudSdkSessionFactoryService', () => {
	const now = Date.parse('2026-08-29T12:00:00.000Z');
	const configuration = {
		clientId: 'deployment-client-id',
		clientSecret: 'deployment-client-secret',
		redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
	};
	const credentials: HomeyCloudActiveGrantCredentials = {
		activatedById: 'admin-user',
		authorityGeneration: 2,
		configurationGeneration: 3,
		generation: 4,
		grantIdentifier: 'grant-1',
		selectedHomeyId: 'homey-1',
		token: {
			accessToken: 'access-token-1',
			expiresIn: 3600,
			grantType: 'authorization_code',
			issuedAt: now,
			refreshToken: 'refresh-token-1',
			tokenType: 'bearer',
		},
	};

	let clientConfig: jest.Mocked<Pick<HomeyCloudClientConfigService, 'getConfiguration'>>;
	let sdkClientFactory: jest.Mocked<Pick<HomeySdkClientFactoryService, 'createCloudProviderClient'>>;
	let grantMutations: jest.Mocked<
		Pick<HomeyCloudGrantMutationService, 'loadActiveGrantCredentials' | 'persistRefresh'>
	>;
	let provider: jest.Mocked<HomeyCloudProviderClient>;
	let client: HomeySdkClient;
	let service: HomeyCloudSdkSessionFactoryService;

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(now);
		client = sdkClient();
		provider = providerClient();
		provider.createHomeyClient.mockResolvedValue(client);
		clientConfig = { getConfiguration: jest.fn().mockReturnValue(configuration) };
		sdkClientFactory = { createCloudProviderClient: jest.fn().mockReturnValue(provider) };
		grantMutations = {
			loadActiveGrantCredentials: jest.fn().mockResolvedValue(credentials),
			persistRefresh: jest.fn(),
		};
		service = new HomeyCloudSdkSessionFactoryService(
			clientConfig as unknown as HomeyCloudClientConfigService,
			sdkClientFactory as unknown as HomeySdkClientFactoryService,
			grantMutations as unknown as HomeyCloudGrantMutationService,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('opens the exact selected Homey from the active grant without exposing credentials downstream', async () => {
		await expect(service.createClient()).resolves.toBe(client);
		expect(sdkClientFactory.createCloudProviderClient).toHaveBeenCalledWith({
			...configuration,
			token: credentials.token,
		});
		expect(provider.createHomeyClient.mock.calls[0]).toEqual(['homey-1', expect.any(AbortSignal), false]);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(0);
		expect(grantMutations.persistRefresh).not.toHaveBeenCalled();
	});

	it('disposes a session when the active grant changes during cloud authentication', async () => {
		const replacement = {
			...credentials,
			generation: 5,
			grantIdentifier: 'grant-2',
			selectedHomeyId: 'homey-2',
		};
		grantMutations.loadActiveGrantCredentials.mockResolvedValueOnce(credentials).mockResolvedValue(replacement);

		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.AUTHENTICATION,
			operation: HomeyConnectorOperation.CONNECT,
		});
		expect((client.disconnect as jest.Mock).mock.calls).toHaveLength(1);
		expect((client.destroy as jest.Mock).mock.calls).toHaveLength(1);
	});

	it('bounds stale-session disconnect and always destroys the client', async () => {
		jest.useFakeTimers({ doNotFake: ['Date'] });
		let resolveCleanupStarted = (): void => undefined;
		const cleanupStarted = new Promise<void>((resolve) => {
			resolveCleanupStarted = resolve;
		});
		(client.disconnect as jest.Mock).mockImplementation(() => {
			resolveCleanupStarted();

			return new Promise<void>(() => undefined);
		});
		grantMutations.loadActiveGrantCredentials.mockResolvedValueOnce(credentials).mockResolvedValue({
			...credentials,
			generation: 5,
			grantIdentifier: 'grant-2',
		});

		const pending = service.createClient();
		const rejection = expect(pending).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.AUTHENTICATION,
			operation: HomeyConnectorOperation.CONNECT,
		});
		await cleanupStarted;
		expect((client.destroy as jest.Mock).mock.calls).toHaveLength(0);
		await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);
		await rejection;
		expect((client.disconnect as jest.Mock).mock.calls).toHaveLength(1);
		expect((client.destroy as jest.Mock).mock.calls).toHaveLength(1);
	});

	it('disposes a cloud client that resolves after the provider deadline', async () => {
		jest.useFakeTimers({ doNotFake: ['Date'] });
		let resolveCreation = (_client: HomeySdkClient): void => undefined;
		let resolveCleanup = (): void => undefined;
		let resolveDestroy = (): void => undefined;
		const creation = new Promise<HomeySdkClient>((resolve) => {
			resolveCreation = resolve;
		});
		const cleanup = new Promise<void>((resolve) => {
			resolveCleanup = resolve;
		});
		const destroyed = new Promise<void>((resolve) => {
			resolveDestroy = resolve;
		});
		(client.disconnect as jest.Mock).mockImplementation(() => {
			resolveCleanup();

			return Promise.resolve();
		});
		(client.destroy as jest.Mock).mockImplementation(resolveDestroy);
		provider.createHomeyClient.mockReturnValue(creation);

		const pending = service.createClient();
		const rejection = expect(pending).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.TIMEOUT,
			operation: HomeyConnectorOperation.CONNECT,
		});
		await Promise.resolve();
		await Promise.resolve();
		await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);
		await rejection;

		resolveCreation(client);
		await cleanup;
		await destroyed;
		expect((client.disconnect as jest.Mock).mock.calls).toHaveLength(1);
		expect((client.destroy as jest.Mock).mock.calls).toHaveLength(1);
	});

	it('refreshes an expiring token, preserves omitted rotation fields, and persists before opening a session', async () => {
		const expiring = {
			...credentials,
			token: {
				...credentials.token,
				issuedAt: now - 3600 * 1000 + HOMEY_CLOUD_TOKEN_REFRESH_SKEW_MS,
			},
		};
		const refreshedClient = sdkClient('homey-1-refreshed');
		const refreshedProvider = providerClient();
		refreshedProvider.createHomeyClient.mockResolvedValue(refreshedClient);
		grantMutations.loadActiveGrantCredentials
			.mockResolvedValueOnce(expiring)
			.mockResolvedValue({ ...credentials, generation: 5 });
		provider.refreshAccessToken.mockResolvedValue({
			access_token: 'access-token-2',
			expires_in: 7200,
			token_type: 'bearer',
		});
		grantMutations.persistRefresh.mockResolvedValue({
			...credentials,
			generation: 5,
		});
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === 'access-token-2' ? refreshedProvider : provider,
		);

		await expect(service.createClient()).resolves.toBe(refreshedClient);
		expect(provider.refreshAccessToken.mock.calls[0]).toEqual(['refresh-token-1', expect.any(AbortSignal)]);
		expect(grantMutations.persistRefresh).toHaveBeenCalledWith({
			configurationGeneration: 3,
			generation: 4,
			grantIdentifier: 'grant-1',
			token: {
				accessToken: 'access-token-2',
				expiresIn: 7200,
				grantType: 'authorization_code',
				issuedAt: now,
				refreshToken: 'refresh-token-1',
				tokenType: 'bearer',
			},
		});
		expect(refreshedProvider.createHomeyClient.mock.calls[0]).toEqual(['homey-1', expect.any(AbortSignal), false]);
	});

	it('refreshes once after an invalid access token and retries authentication with the rotated token', async () => {
		const refreshedClient = sdkClient('homey-1-refreshed');
		const refreshedProvider = providerClient();
		provider.createHomeyClient.mockRejectedValue(
			new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
			),
		);
		provider.refreshAccessToken.mockResolvedValue({
			access_token: 'access-token-2',
			expires_in: 3600,
			refresh_token: 'refresh-token-2',
			token_type: 'bearer',
		});
		grantMutations.persistRefresh.mockResolvedValue({ ...credentials, generation: 5 });
		grantMutations.loadActiveGrantCredentials
			.mockResolvedValueOnce(credentials)
			.mockResolvedValueOnce(credentials)
			.mockResolvedValue({ ...credentials, generation: 5 });
		refreshedProvider.createHomeyClient.mockResolvedValue(refreshedClient);
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === 'access-token-2' ? refreshedProvider : provider,
		);

		await expect(service.createClient()).resolves.toBe(refreshedClient);
		expect(provider.createHomeyClient.mock.calls).toHaveLength(1);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(1);
		expect(refreshedProvider.createHomeyClient.mock.calls).toHaveLength(1);
	});

	it('uses a refresh persisted by a faster caller instead of retrying the stale refresh token', async () => {
		let rejectFirst = (_error: unknown): void => undefined;
		let rejectSecond = (_error: unknown): void => undefined;
		let active = credentials;
		const firstAuthentication = new Promise<HomeySdkClient>((_resolve, reject) => {
			rejectFirst = reject;
		});
		const secondAuthentication = new Promise<HomeySdkClient>((_resolve, reject) => {
			rejectSecond = reject;
		});
		const refreshedClient = sdkClient('homey-1-refreshed');
		const refreshedProvider = providerClient();
		provider.createHomeyClient.mockReturnValueOnce(firstAuthentication).mockReturnValueOnce(secondAuthentication);
		provider.refreshAccessToken.mockResolvedValue({
			access_token: 'access-token-2',
			expires_in: 3600,
			refresh_token: 'refresh-token-2',
			token_type: 'bearer',
		});
		grantMutations.loadActiveGrantCredentials.mockImplementation(() => Promise.resolve(active));
		grantMutations.persistRefresh.mockImplementation(({ token }) => {
			active = { ...credentials, generation: 5, token };

			return Promise.resolve(active);
		});
		refreshedProvider.createHomeyClient.mockResolvedValue(refreshedClient);
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === 'access-token-2' ? refreshedProvider : provider,
		);

		const first = service.createClient();
		const second = service.createClient();
		await Promise.resolve();
		await Promise.resolve();
		rejectFirst(
			new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
			),
		);
		await expect(first).resolves.toBe(refreshedClient);

		rejectSecond(
			new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
			),
		);
		await expect(second).resolves.toBe(refreshedClient);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(1);
		expect(grantMutations.persistRefresh).toHaveBeenCalledTimes(1);
		expect(refreshedProvider.createHomeyClient.mock.calls).toHaveLength(2);
	});

	it('applies expiry recovery to a replacement grant reloaded after invalid authentication', async () => {
		const replacement: HomeyCloudActiveGrantCredentials = {
			...credentials,
			generation: 8,
			grantIdentifier: 'grant-2',
			selectedHomeyId: 'homey-2',
			token: {
				...credentials.token,
				accessToken: 'replacement-access-token',
				issuedAt: now - 3600 * 1000,
				refreshToken: 'replacement-refresh-token',
			},
		};
		let active = credentials;
		const replacementClient = sdkClient('homey-2');
		const replacementProvider = providerClient();
		provider.createHomeyClient.mockImplementation(() => {
			active = replacement;

			return Promise.reject(
				new HomeyCloudProviderError(
					HomeyCloudProviderErrorCategory.INVALID_TOKEN,
					HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
				),
			);
		});
		replacementProvider.refreshAccessToken.mockResolvedValue({
			access_token: 'replacement-access-token-2',
			expires_in: 3600,
			refresh_token: 'replacement-refresh-token-2',
			token_type: 'bearer',
		});
		replacementProvider.createHomeyClient.mockResolvedValue(replacementClient);
		grantMutations.loadActiveGrantCredentials.mockImplementation(() => Promise.resolve(active));
		grantMutations.persistRefresh.mockImplementation(({ token }) => {
			active = { ...replacement, generation: 9, token };

			return Promise.resolve(active);
		});
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === credentials.token.accessToken ? provider : replacementProvider,
		);

		await expect(service.createClient()).resolves.toBe(replacementClient);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(0);
		expect(replacementProvider.refreshAccessToken.mock.calls[0]).toEqual([
			'replacement-refresh-token',
			expect.any(AbortSignal),
		]);
		expect(grantMutations.persistRefresh).toHaveBeenCalledTimes(1);
		expect(replacementProvider.createHomeyClient.mock.calls[0]).toEqual(['homey-2', expect.any(AbortSignal), false]);
	});

	it('uses the current active grant when refresh persistence loses its compare-and-swap', async () => {
		const expiring = {
			...credentials,
			token: { ...credentials.token, issuedAt: now - 3600 * 1000 },
		};
		const replacement = {
			...credentials,
			generation: 8,
			grantIdentifier: 'grant-2',
			selectedHomeyId: 'homey-2',
			token: { ...credentials.token, accessToken: 'replacement-access-token', issuedAt: now },
		};
		const replacementClient = sdkClient('homey-2');
		const replacementProvider = providerClient();
		provider.refreshAccessToken.mockResolvedValue({
			access_token: 'lost-refresh-access-token',
			expires_in: 3600,
			token_type: 'bearer',
		});
		grantMutations.loadActiveGrantCredentials.mockResolvedValueOnce(expiring).mockResolvedValue(replacement);
		grantMutations.persistRefresh.mockResolvedValue(null);
		replacementProvider.createHomeyClient.mockResolvedValue(replacementClient);
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === 'replacement-access-token' ? replacementProvider : provider,
		);

		await expect(service.createClient()).resolves.toBe(replacementClient);
		expect(replacementProvider.createHomeyClient.mock.calls[0]).toEqual(['homey-2', expect.any(AbortSignal), false]);
	});

	it('recovers an expired replacement grant returned after a lost refresh compare-and-swap', async () => {
		const expiring = {
			...credentials,
			token: { ...credentials.token, issuedAt: now - 3600 * 1000 },
		};
		const replacement: HomeyCloudActiveGrantCredentials = {
			...credentials,
			generation: 8,
			grantIdentifier: 'grant-2',
			selectedHomeyId: 'homey-2',
			token: {
				...credentials.token,
				accessToken: 'replacement-access-token',
				issuedAt: now - 3600 * 1000,
				refreshToken: 'replacement-refresh-token',
			},
		};
		let active = expiring;
		let persistenceAttempt = 0;
		const replacementClient = sdkClient('homey-2');
		const replacementProvider = providerClient();
		provider.refreshAccessToken.mockResolvedValue({
			access_token: 'lost-refresh-access-token',
			expires_in: 3600,
			token_type: 'bearer',
		});
		replacementProvider.refreshAccessToken.mockResolvedValue({
			access_token: 'replacement-access-token-2',
			expires_in: 3600,
			refresh_token: 'replacement-refresh-token-2',
			token_type: 'bearer',
		});
		replacementProvider.createHomeyClient.mockResolvedValue(replacementClient);
		grantMutations.loadActiveGrantCredentials.mockImplementation(() => Promise.resolve(active));
		grantMutations.persistRefresh.mockImplementation(({ token }) => {
			persistenceAttempt += 1;

			if (persistenceAttempt === 1) {
				active = replacement;

				return Promise.resolve(null);
			}

			active = { ...replacement, generation: 9, token };

			return Promise.resolve(active);
		});
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === credentials.token.accessToken ? provider : replacementProvider,
		);

		await expect(service.createClient()).resolves.toBe(replacementClient);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(1);
		expect(replacementProvider.refreshAccessToken.mock.calls[0]).toEqual([
			'replacement-refresh-token',
			expect.any(AbortSignal),
		]);
		expect(grantMutations.persistRefresh).toHaveBeenCalledTimes(2);
		expect(replacementProvider.createHomeyClient.mock.calls[0]).toEqual(['homey-2', expect.any(AbortSignal), false]);
	});

	it('uses a replacement grant when the stale refresh is rejected before persistence', async () => {
		const expiring = {
			...credentials,
			token: { ...credentials.token, issuedAt: now - 3600 * 1000 },
		};
		const replacement: HomeyCloudActiveGrantCredentials = {
			...credentials,
			generation: 8,
			grantIdentifier: 'grant-2',
			selectedHomeyId: 'homey-2',
			token: {
				...credentials.token,
				accessToken: 'replacement-access-token',
				issuedAt: now,
			},
		};
		let active = expiring;
		const replacementClient = sdkClient('homey-2');
		const replacementProvider = providerClient();
		provider.refreshAccessToken.mockImplementation(() => {
			active = replacement;

			return Promise.reject(
				new HomeyCloudProviderError(
					HomeyCloudProviderErrorCategory.INVALID_TOKEN,
					HomeyCloudProviderOperation.REFRESH_TOKEN,
				),
			);
		});
		replacementProvider.createHomeyClient.mockResolvedValue(replacementClient);
		grantMutations.loadActiveGrantCredentials.mockImplementation(() => Promise.resolve(active));
		sdkClientFactory.createCloudProviderClient.mockImplementation(({ token }) =>
			token?.accessToken === 'replacement-access-token' ? replacementProvider : provider,
		);

		await expect(service.createClient()).resolves.toBe(replacementClient);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(1);
		expect(grantMutations.persistRefresh).not.toHaveBeenCalled();
		expect(replacementProvider.createHomeyClient.mock.calls[0]).toEqual(['homey-2', expect.any(AbortSignal), false]);
	});

	it('coalesces concurrent refreshes through one provider request and persistence mutation', async () => {
		let resolveRefresh = (_value: unknown): void => undefined;
		const refresh = new Promise<Record<string, unknown>>((resolve) => {
			resolveRefresh = resolve;
		});
		const expiring = {
			...credentials,
			token: { ...credentials.token, issuedAt: now - 3600 * 1000 },
		};
		grantMutations.loadActiveGrantCredentials
			.mockResolvedValueOnce(expiring)
			.mockResolvedValueOnce(expiring)
			.mockResolvedValue({ ...credentials, generation: 5 });
		provider.refreshAccessToken.mockReturnValue(refresh);
		grantMutations.persistRefresh.mockResolvedValue({ ...credentials, generation: 5 });

		const first = service.createClient();
		const second = service.createClient();
		await Promise.resolve();
		resolveRefresh({ access_token: 'access-token-2', expires_in: 3600, token_type: 'bearer' });
		await expect(Promise.all([first, second])).resolves.toEqual([client, client]);
		expect(provider.refreshAccessToken.mock.calls).toHaveLength(1);
		expect(grantMutations.persistRefresh).toHaveBeenCalledTimes(1);
	});

	it('maps missing grants, configuration errors, rate limits, and invalid refreshes to fixed connector categories', async () => {
		grantMutations.loadActiveGrantCredentials.mockResolvedValueOnce(null);
		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.AUTHENTICATION,
			operation: HomeyConnectorOperation.CONNECT,
		});

		clientConfig.getConfiguration.mockImplementationOnce(() => {
			throw new HomeyCloudConfigurationError();
		});
		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.VALIDATION,
			operation: HomeyConnectorOperation.CONNECT,
		});

		provider.createHomeyClient.mockRejectedValueOnce(
			new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.RATE_LIMITED,
				HomeyCloudProviderOperation.AUTHENTICATE_HOMEY,
			),
		);
		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.UNAVAILABLE,
			retryable: true,
		});

		grantMutations.loadActiveGrantCredentials.mockResolvedValueOnce({
			...credentials,
			token: { ...credentials.token, issuedAt: now - 3600 * 1000, refreshToken: null },
		});
		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.AUTHENTICATION,
			retryable: false,
		});
	});

	it('rejects and disposes a structurally incomplete SDK client as a sanitized protocol failure', async () => {
		const invalidClient = {
			disconnect: jest.fn().mockRejectedValue(new Error('private cleanup failure')),
			destroy: jest.fn(),
		};
		provider.createHomeyClient.mockResolvedValue(invalidClient as unknown as HomeySdkClient);

		await expect(service.createClient()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.PROTOCOL,
			operation: HomeyConnectorOperation.CONNECT,
		});
		expect(invalidClient.disconnect).toHaveBeenCalledTimes(1);
		expect(invalidClient.destroy).toHaveBeenCalledTimes(1);
	});
});

function providerClient(): jest.Mocked<HomeyCloudProviderClient> {
	return {
		authenticateHomey: jest.fn(),
		createHomeyClient: jest.fn(),
		exchangeAuthorizationCode: jest.fn(),
		getHomeys: jest.fn(),
		refreshAccessToken: jest.fn(),
	};
}

function sdkClient(id = 'homey-1'): HomeySdkClient {
	const eventSource = { on: jest.fn(), off: jest.fn() };

	return {
		id,
		name: 'Homey',
		version: '13.4.1',
		devices: {
			...eventSource,
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			getDevice: jest.fn(),
			getDevices: jest.fn(),
			setCapabilityValue: jest.fn(),
		},
		system: { getInfo: jest.fn() },
		zones: {
			...eventSource,
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			getZones: jest.fn(),
		},
		disconnect: jest.fn().mockResolvedValue(undefined),
		destroy: jest.fn(),
	};
}
