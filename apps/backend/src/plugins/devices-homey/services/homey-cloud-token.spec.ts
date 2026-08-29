import {
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
} from '../errors/homey-cloud-authorization.error';

import {
	homeyCloudTokenExpiresAt,
	homeyCloudTokenRequiresRefresh,
	normalizeHomeyCloudToken,
} from './homey-cloud-token';

describe('Homey Cloud token normalization', () => {
	const issuedAt = Date.parse('2026-08-29T12:00:00.000Z');

	it('normalizes an authorization token and calculates its absolute expiry', () => {
		const token = normalizeHomeyCloudToken(
			{
				access_token: 'access-token',
				expires_in: 3600,
				grant_type: 'authorization_code',
				refresh_token: 'refresh-token',
				token_type: 'Bearer',
			},
			issuedAt,
			HomeyCloudProviderOperation.EXCHANGE_CODE,
		);

		expect(token).toStrictEqual({
			accessToken: 'access-token',
			expiresIn: 3600,
			grantType: 'authorization_code',
			issuedAt,
			refreshToken: 'refresh-token',
			tokenType: 'bearer',
		});
		expect(homeyCloudTokenExpiresAt(token, HomeyCloudProviderOperation.EXCHANGE_CODE, issuedAt)).toBe(
			issuedAt + 3600 * 1000,
		);
	});

	it('retains refresh and grant fields when a valid refresh response omits them', () => {
		expect(
			normalizeHomeyCloudToken(
				{ access_token: 'access-token-2', expires_in: 7200, token_type: 'bearer' },
				issuedAt,
				HomeyCloudProviderOperation.REFRESH_TOKEN,
				{ grantType: 'authorization_code', refreshToken: 'refresh-token-1' },
			),
		).toMatchObject({
			accessToken: 'access-token-2',
			grantType: 'authorization_code',
			refreshToken: 'refresh-token-1',
		});
	});

	it.each([
		{ token_type: 'mac', access_token: 'access-token' },
		{ token_type: 'bearer', access_token: '' },
		{ token_type: 'bearer', access_token: 'access-token', expires_in: 0 },
		{ token_type: 'bearer', access_token: 'access-token', refresh_token: '' },
	])('rejects malformed token material without echoing it', (response) => {
		try {
			normalizeHomeyCloudToken(response, issuedAt, HomeyCloudProviderOperation.REFRESH_TOKEN);
		} catch (error) {
			expect(error).toMatchObject({
				category: HomeyCloudProviderErrorCategory.PROTOCOL,
				operation: HomeyCloudProviderOperation.REFRESH_TOKEN,
			});

			return;
		}

		throw new Error('Malformed Homey Cloud token was accepted');
	});

	it('uses the refresh skew boundary without treating non-expiring tokens as expired', () => {
		const expiringToken = {
			accessToken: 'access-token',
			expiresIn: 120,
			grantType: null,
			issuedAt,
			refreshToken: 'refresh-token',
			tokenType: 'bearer',
		};

		expect(homeyCloudTokenRequiresRefresh(expiringToken, issuedAt + 59_000, 60_000)).toBe(false);
		expect(homeyCloudTokenRequiresRefresh(expiringToken, issuedAt + 60_000, 60_000)).toBe(true);
		expect(homeyCloudTokenRequiresRefresh({ ...expiringToken, expiresIn: null }, issuedAt + 60_000, 60_000)).toBe(
			false,
		);
	});
});
