import { AthomCloudAPI } from 'homey-api';

import { HOMEY_CLOUD_CALLBACK_PATH, HOMEY_CLOUD_SCOPES } from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';

import { HomeySdkClientFactoryService } from './homey-sdk.client';

describe('HomeySdkClientFactoryService', () => {
	const originalBaseUrl = process.env.ATHOM_CLOUD_API_BASEURL;

	afterEach(() => {
		jest.restoreAllMocks();

		if (originalBaseUrl === undefined) {
			delete process.env.ATHOM_CLOUD_API_BASEURL;
		} else {
			process.env.ATHOM_CLOUD_API_BASEURL = originalBaseUrl;
		}
	});

	it('creates isolated provider clients for exchange and sanitized Homey access', async () => {
		const token = {
			token_type: 'bearer',
			access_token: 'provider-access-token',
			refresh_token: 'provider-refresh-token',
			expires_in: 3600,
			grant_type: 'authorization_code',
		};
		const fetchMock = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify(token), { status: 200, headers: { 'Content-Type': 'application/json' } }),
			);
		const homeyApi = {
			disconnect: jest.fn().mockResolvedValue(undefined),
			destroy: jest.fn(),
		};
		const homey = {
			id: 'homey-one',
			name: 'Home',
			apiVersion: 3,
			platform: 'local',
			authenticate: jest.fn().mockResolvedValue(homeyApi),
		};
		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
			getHomeys: () => [homey],
			getHomeyById: () => homey,
		} as unknown as AthomCloudAPI.User);
		const factory = new HomeySdkClientFactoryService();
		const provider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		const candidateProvider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: token.access_token,
				refreshToken: token.refresh_token,
				expiresIn: token.expires_in,
				grantType: token.grant_type,
			},
		});

		const controller = new AbortController();

		await expect(provider.exchangeAuthorizationCode('authorization-code', controller.signal)).resolves.toEqual(token);
		await expect(candidateProvider.getHomeys(controller.signal)).resolves.toEqual([
			{ id: 'homey-one', name: 'Home', apiVersion: 3, platform: 'local' },
		]);
		await expect(candidateProvider.authenticateHomey('homey-one', controller.signal)).resolves.toBeUndefined();
		const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0];

		expect(tokenUrl).toBe('https://api.athom.com/oauth2/token');
		expect(tokenRequest?.redirect).toBe('error');
		expect(tokenRequest?.signal).toBeInstanceOf(AbortSignal);
		expect(tokenRequest?.body).toBeInstanceOf(URLSearchParams);
		expect((tokenRequest?.body as URLSearchParams).toString()).toBe(
			'grant_type=authorization_code&code=authorization-code',
		);
		expect(homey.authenticate).toHaveBeenCalledWith({ strategy: 'cloud', reconnect: false });
		expect(homeyApi.disconnect).toHaveBeenCalledTimes(1);
		expect(homeyApi.destroy).toHaveBeenCalledTimes(1);
	});

	it('aborts the underlying authorization-code exchange when its caller cancels', async () => {
		let requestSignal: AbortSignal | null = null;
		jest.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
			requestSignal = init?.signal ?? null;

			return new Promise((_resolve, reject) => {
				requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
					once: true,
				});
			});
		});
		const factory = new HomeySdkClientFactoryService();
		const provider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		const controller = new AbortController();
		const exchange = provider.exchangeAuthorizationCode('authorization-code', controller.signal);

		controller.abort();

		await expect(exchange).rejects.toMatchObject({ code: 'ABORTERROR' });
		expect(requestSignal?.aborted).toBe(true);
	});

	it('creates a Homey Cloud authorization URL without exposing the client secret', () => {
		const factory = new HomeySdkClientFactoryService();
		const clientSecret = 'deployment-client-secret';
		const redirectUrl = `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`;
		const state = 'single-use-random-state';
		const result = factory.createCloudAuthorizationUrl({
			clientId: 'deployment-client-id',
			clientSecret,
			redirectUrl,
			scopes: [...HOMEY_CLOUD_SCOPES],
			state,
		});
		const url = new URL(result);

		expect(url.origin + url.pathname).toBe('https://api.athom.com/oauth2/authorise');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('client_id')).toBe('deployment-client-id');
		expect(url.searchParams.get('redirect_uri')).toBe(redirectUrl);
		expect(url.searchParams.get('scope')).toBe(HOMEY_CLOUD_SCOPES.join(','));
		expect(url.searchParams.get('state')).toBe(state);
		expect(result).not.toContain(clientSecret);
	});

	it('rejects authorization and provider clients redirected by the SDK base URL environment override', () => {
		process.env.ATHOM_CLOUD_API_BASEURL = 'https://untrusted.example.com';
		const factory = new HomeySdkClientFactoryService();

		expect(() =>
			factory.createCloudAuthorizationUrl({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
				scopes: [...HOMEY_CLOUD_SCOPES],
				state: 'single-use-random-state',
			}),
		).toThrow(HomeyCloudConfigurationError);
		expect(() =>
			factory.createCloudProviderClient({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			}),
		).toThrow(HomeyCloudConfigurationError);
	});
});
