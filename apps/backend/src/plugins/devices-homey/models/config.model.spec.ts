import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { MAX_HOMEY_URL_LENGTH, isSafeHomeyUrl } from '../validators/homey-url.validator';

import { HomeyConfigModel } from './config.model';

describe('Homey configuration', () => {
	it('keeps disabled and incomplete enabled defaults structurally valid for deferred startup', () => {
		expect(validateSync(new HomeyConfigModel())).toEqual([]);
		expect(validateSync(Object.assign(new HomeyConfigModel(), { enabled: true }))).toEqual([]);
	});

	it('projects the locally stored API key as a configured indicator', () => {
		const secrets = new ConfigSecretsService();
		const config = Object.assign(new HomeyConfigModel(), {
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
		});
		const projected = secrets.toPublic(config, [
			{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] },
		]) as unknown as Record<string, unknown>;

		expect(projected).not.toHaveProperty('api_key');
		expect(projected).not.toHaveProperty('apiKey');
		expect(projected).toHaveProperty('api_key_configured', true);
		expect(JSON.stringify(projected)).not.toContain('configured-secret');
	});

	it('loads obsolete remote fields only long enough to remove them from storage', () => {
		const config = plainToInstance(
			HomeyConfigModel,
			{
				type: 'devices-homey-plugin',
				mode: 'cloud',
				cloud_client_id: 'obsolete-client',
				cloud_client_secret: 'obsolete-secret',
				cloud_redirect_url: 'https://obsolete.example/callback',
				cloud_legacy_environment_migrated: true,
			},
			{ excludeExtraneousValues: false },
		);

		expect(config.legacyConnectionMode).toBe('cloud');
		expect(config.legacyRemoteClientSecret).toBe('obsolete-secret');
		const persisted = instanceToPlain(config);
		expect(persisted).not.toHaveProperty('mode');
		expect(persisted).not.toHaveProperty('cloud_client_id');
		expect(persisted).not.toHaveProperty('cloud_client_secret');
		expect(persisted).not.toHaveProperty('cloud_redirect_url');
		expect(persisted).not.toHaveProperty('cloud_legacy_environment_migrated');
	});

	it('accepts snake-case update fields while keeping the API key optional', () => {
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			api_key: 'replacement-secret',
			connection_timeout: 5000,
			reconciliation_interval: 60000,
		});

		expect(update.apiKey).toBe('replacement-secret');
		expect(update.connectionTimeout).toBe(5000);
		expect(update.reconciliationInterval).toBe(60000);
		expect(validateSync(update)).toEqual([]);
	});

	it('rejects embedded URL credentials in stored and update configuration', () => {
		const url = 'http://owner:credential@homey.local:4859';
		const config = Object.assign(new HomeyConfigModel(), { url });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, { type: 'devices-homey-plugin', url });

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
	});

	it('rejects URLs above the bounded SDK transport input length', () => {
		const url = `http://homey.local/${'a'.repeat(MAX_HOMEY_URL_LENGTH)}`;
		const config = Object.assign(new HomeyConfigModel(), { url });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, { type: 'devices-homey-plugin', url });

		expect(isSafeHomeyUrl(url)).toBe(false);
		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
	});

	it('rejects whitespace-only API keys in stored and update configuration', () => {
		const config = Object.assign(new HomeyConfigModel(), { apiKey: '   ' });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			api_key: '   ',
		});

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
	});
});
