import { HOMEY_CLOUD_CALLBACK_PATH, HOMEY_CLOUD_SCOPES } from '../devices-homey.constants';

import { HomeySdkClientFactoryService } from './homey-sdk.client';

describe('HomeySdkClientFactoryService', () => {
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
});
