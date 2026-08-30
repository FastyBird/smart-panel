import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { HomeyConnectionMode } from '../devices-homey.constants';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { MAX_HOMEY_URL_LENGTH, isSafeHomeyUrl } from '../validators/homey-url.validator';

import { HomeyConfigModel } from './config.model';

describe('Homey configuration', () => {
	it('keeps the disabled defaults structurally valid', () => {
		expect(validateSync(new HomeyConfigModel())).toEqual([]);
	});

	it('keeps an incomplete enabled configuration structurally valid for deferred startup', () => {
		expect(validateSync(Object.assign(new HomeyConfigModel(), { enabled: true }))).toEqual([]);
	});

	it('accepts a complete cloud configuration without local credentials', () => {
		const config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			mode: HomeyConnectionMode.CLOUD,
			cloudClientId: 'client-id',
			cloudClientSecret: 'client-secret',
			cloudRedirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		});

		expect(validateSync(config)).toEqual([]);
	});

	it('keeps incomplete cloud mode structurally valid so readiness validation can defer startup', () => {
		expect(validateSync(Object.assign(new HomeyConfigModel(), { mode: HomeyConnectionMode.CLOUD }))).toEqual([]);
	});

	it('projects local and cloud secrets as configured indicators', () => {
		const secrets = new ConfigSecretsService();
		const config = Object.assign(new HomeyConfigModel(), {
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
			cloudClientSecret: 'configured-cloud-secret',
		});

		const projected = secrets.toPublic(config, [
			{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] },
			{
				path: 'cloud_client_secret',
				configuredPath: 'cloud_client_secret_configured',
				inputPaths: ['cloudClientSecret'],
			},
		]) as unknown as Record<string, unknown>;

		expect(projected).not.toHaveProperty('api_key');
		expect(projected).not.toHaveProperty('apiKey');
		expect(projected).toHaveProperty('api_key_configured', true);
		expect(projected).not.toHaveProperty('cloud_client_secret');
		expect(projected).not.toHaveProperty('cloudClientSecret');
		expect(projected).toHaveProperty('cloud_client_secret_configured', true);
		expect(JSON.stringify(projected)).not.toContain('configured-secret');
		expect(JSON.stringify(projected)).not.toContain('configured-cloud-secret');
	});

	it('accepts snake-case update fields while keeping the API key optional', () => {
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			mode: HomeyConnectionMode.CLOUD,
			api_key: 'replacement-secret',
			cloud_client_id: 'client-id',
			cloud_client_secret: 'client-secret',
			cloud_redirect_url: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			connection_timeout: 5000,
			reconciliation_interval: 60000,
		});

		expect(update.apiKey).toBe('replacement-secret');
		expect(update.mode).toBe(HomeyConnectionMode.CLOUD);
		expect(update.cloudClientId).toBe('client-id');
		expect(update.cloudClientSecret).toBe('client-secret');
		expect(update.cloudRedirectUrl).toBe('https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback');
		expect(update.connectionTimeout).toBe(5000);
		expect(update.reconciliationInterval).toBe(60000);
		expect(validateSync(update)).toEqual([]);
	});

	it('preserves a stored Cloud client secret when the admin leaves its write-only field blank', () => {
		const secrets = new ConfigSecretsService();
		const existing = Object.assign(new HomeyConfigModel(), {
			mode: HomeyConnectionMode.CLOUD,
			cloudClientId: 'client-id',
			cloudClientSecret: 'stored-client-secret',
			cloudRedirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		});
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			cloud_client_id: 'updated-client-id',
		});
		const resolved = secrets.resolveUpdate(existing, update, { cloud_client_id: 'updated-client-id' }, [
			{
				path: 'cloud_client_secret',
				configuredPath: 'cloud_client_secret_configured',
				inputPaths: ['cloudClientSecret'],
			},
		]) as unknown as Record<string, unknown>;

		expect(resolved['cloud_client_secret']).toBe('stored-client-secret');
		expect(
			JSON.stringify(
				secrets.toPublic(resolved, [
					{
						path: 'cloud_client_secret',
						configuredPath: 'cloud_client_secret_configured',
					},
				]),
			),
		).not.toContain('stored-client-secret');
	});

	it('rejects embedded URL credentials in stored and update configuration', () => {
		const url = 'http://owner:credential@homey.local:4859';
		const config = Object.assign(new HomeyConfigModel(), { url });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			url,
		});

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
	});

	it('rejects URLs above the bounded SDK transport input length', () => {
		const url = `http://homey.local/${'a'.repeat(MAX_HOMEY_URL_LENGTH)}`;
		const config = Object.assign(new HomeyConfigModel(), { url });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			url,
		});

		expect(isSafeHomeyUrl(url)).toBe(false);
		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
	});

	it('rejects whitespace-only API keys in stored and update configuration', () => {
		const config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: '   ',
		});
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			api_key: '   ',
		});

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
	});
});
