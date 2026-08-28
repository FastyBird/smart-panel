import { ConfigService as NestConfigService } from '@nestjs/config';

import {
	HOMEY_CLOUD_CALLBACK_PATH,
	HOMEY_CLOUD_CLIENT_ID_ENV,
	HOMEY_CLOUD_CLIENT_SECRET_ENV,
	HOMEY_CLOUD_REDIRECT_URL_ENV,
} from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';

describe('HomeyCloudClientConfigService', () => {
	const valid = {
		[HOMEY_CLOUD_CLIENT_ID_ENV]: ' client-id ',
		[HOMEY_CLOUD_CLIENT_SECRET_ENV]: ' client-secret ',
		[HOMEY_CLOUD_REDIRECT_URL_ENV]: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
	};

	function create(values: Record<string, unknown> = valid): HomeyCloudClientConfigService {
		return new HomeyCloudClientConfigService({
			get: jest.fn((key: string) => values[key]),
		} as unknown as NestConfigService);
	}

	it('returns trimmed deployment-owned client configuration', () => {
		expect(create().getConfiguration()).toEqual({
			clientId: 'client-id',
			clientSecret: 'client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		expect(create().isConfigured()).toBe(true);
	});

	it.each([HOMEY_CLOUD_CLIENT_ID_ENV, HOMEY_CLOUD_CLIENT_SECRET_ENV, HOMEY_CLOUD_REDIRECT_URL_ENV])(
		'fails closed when %s is missing',
		(key) => {
			const service = create({ ...valid, [key]: '   ' });

			expect(() => service.getConfiguration()).toThrow(HomeyCloudConfigurationError);
			expect(service.isConfigured()).toBe(false);
		},
	);

	it.each([
		'not-a-url',
		`http://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		'https://user:password@panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback?next=/admin',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback#fragment',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/other',
	])('rejects an unsafe or inexact redirect URL: %s', (redirectUrl) => {
		const service = create({ ...valid, [HOMEY_CLOUD_REDIRECT_URL_ENV]: redirectUrl });

		expect(() => service.getConfiguration()).toThrow(HomeyCloudConfigurationError);
		expect(service.isConfigured()).toBe(false);
	});

	it.each(['localhost', '127.0.0.1', '[::1]'])('allows HTTP only for the loopback host %s', (host) => {
		const redirectUrl = `http://${host}:3000${HOMEY_CLOUD_CALLBACK_PATH}`;

		expect(create({ ...valid, [HOMEY_CLOUD_REDIRECT_URL_ENV]: redirectUrl }).getConfiguration().redirectUrl).toBe(
			redirectUrl,
		);
	});
});
