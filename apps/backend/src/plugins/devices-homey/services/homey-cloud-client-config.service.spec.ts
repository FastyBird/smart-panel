import { ConfigService } from '../../../modules/config/services/config.service';
import { HOMEY_CLOUD_CALLBACK_PATH } from '../devices-homey.constants';
import { HomeyCloudConfigurationError } from '../errors/homey-cloud-authorization.error';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';

describe('HomeyCloudClientConfigService', () => {
	const valid = {
		cloudClientId: ' client-id ',
		cloudClientSecret: ' client-secret ',
		cloudRedirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
	};

	function create(values: Record<string, unknown> = valid): HomeyCloudClientConfigService {
		return new HomeyCloudClientConfigService({
			getPluginConfig: jest.fn(() => Object.assign(new HomeyConfigModel(), values)),
		} as unknown as ConfigService);
	}

	it('returns trimmed admin-managed client configuration', () => {
		expect(create().getConfiguration()).toEqual({
			clientId: 'client-id',
			clientSecret: 'client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		expect(create().isConfigured()).toBe(true);
	});

	it('creates a stable non-secret identity for the complete OAuth client configuration', () => {
		const service = create();
		const fingerprint = service.getConfigurationFingerprint();

		expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect(
			service.getConfigurationFingerprintFor({
				clientId: valid.cloudClientId,
				clientSecret: valid.cloudClientSecret,
				redirectUrl: valid.cloudRedirectUrl,
			}),
		).toBe(fingerprint);
		expect(create().getConfigurationFingerprint()).toBe(fingerprint);
		expect(create({ ...valid, cloudClientSecret: 'rotated-secret' }).getConfigurationFingerprint()).not.toBe(
			fingerprint,
		);
		expect(fingerprint).not.toContain('client-secret');
	});

	it('rejects incomplete candidate configuration fingerprints', () => {
		expect(
			create().getConfigurationFingerprintFor({
				clientId: 'client-id',
				clientSecret: null,
				redirectUrl: valid.cloudRedirectUrl,
			}),
		).toBeNull();
	});

	it.each(['cloudClientId', 'cloudClientSecret', 'cloudRedirectUrl'])('fails closed when %s is missing', (key) => {
		const service = create({ ...valid, [key]: '   ' });

		expect(() => service.getConfiguration()).toThrow(HomeyCloudConfigurationError);
		expect(service.isConfigured()).toBe(false);
		expect(service.getConfigurationFingerprint()).toBeNull();
	});

	it.each([
		'not-a-url',
		`http://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		'https://user:password@panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback?next=/admin',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback#fragment',
		'https://panel.example.com/api/v1/plugins/devices-homey/oauth/other',
	])('rejects an unsafe or inexact redirect URL: %s', (redirectUrl) => {
		const service = create({ ...valid, cloudRedirectUrl: redirectUrl });

		expect(() => service.getConfiguration()).toThrow(HomeyCloudConfigurationError);
		expect(service.isConfigured()).toBe(false);
	});

	it.each(['localhost', '127.0.0.1', '[::1]'])('allows HTTP only for the loopback host %s', (host) => {
		const redirectUrl = `http://${host}:3000${HOMEY_CLOUD_CALLBACK_PATH}`;

		expect(create({ ...valid, cloudRedirectUrl: redirectUrl }).getConfiguration().redirectUrl).toBe(redirectUrl);
	});
});
