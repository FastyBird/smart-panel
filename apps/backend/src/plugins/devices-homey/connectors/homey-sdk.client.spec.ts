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
		const authenticateWithAuthorizationCode = jest
			.spyOn(AthomCloudAPI.prototype, 'authenticateWithAuthorizationCode')
			.mockResolvedValue(token as unknown as AthomCloudAPI.Token);
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

		await expect(provider.exchangeAuthorizationCode('authorization-code')).resolves.toBe(token);
		await expect(candidateProvider.getHomeys()).resolves.toEqual([
			{ id: 'homey-one', name: 'Home', apiVersion: 3, platform: 'local' },
		]);
		await expect(candidateProvider.authenticateHomey('homey-one')).resolves.toBeUndefined();
		expect(authenticateWithAuthorizationCode).toHaveBeenCalledWith({
			code: 'authorization-code',
			removeCodeFromHistory: false,
		});
		expect(homey.authenticate).toHaveBeenCalledWith({ strategy: 'cloud', reconnect: false });
		expect(homeyApi.disconnect).toHaveBeenCalledTimes(1);
		expect(homeyApi.destroy).toHaveBeenCalledTimes(1);
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

	it('rejects an authorization URL redirected by the SDK base URL environment override', () => {
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
	});
});
