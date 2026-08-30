import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_CLOUD_CLIENT_ID_ENV,
	HOMEY_CLOUD_CLIENT_SECRET_ENV,
	HOMEY_CLOUD_REDIRECT_URL_ENV,
} from '../devices-homey.constants';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyLegacyCloudConfigMigrationService } from './homey-legacy-cloud-config-migration.service';

describe('HomeyLegacyCloudConfigMigrationService', () => {
	const redirectUrl = 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback';
	let config: jest.Mocked<Pick<ConfigService, 'getPluginConfig' | 'setPluginConfig'>>;
	let environmentValues: Record<string, unknown>;
	let service: HomeyLegacyCloudConfigMigrationService;

	beforeEach(() => {
		environmentValues = {
			[HOMEY_CLOUD_CLIENT_ID_ENV]: ' legacy-client ',
			[HOMEY_CLOUD_CLIENT_SECRET_ENV]: ' legacy-secret ',
			[HOMEY_CLOUD_REDIRECT_URL_ENV]: ` ${redirectUrl} `,
		};
		config = {
			getPluginConfig: jest.fn().mockReturnValue(new HomeyConfigModel()),
			setPluginConfig: jest.fn(),
		};
		service = new HomeyLegacyCloudConfigMigrationService(
			config as unknown as ConfigService,
			{ get: jest.fn((key: string) => environmentValues[key]) } as unknown as NestConfigService,
		);
	});

	it('imports complete legacy environment settings into admin-managed configuration once', () => {
		service.migrate();

		expect(config.setPluginConfig).toHaveBeenCalledWith(
			DEVICES_HOMEY_PLUGIN_NAME,
			expect.objectContaining({
				type: DEVICES_HOMEY_PLUGIN_NAME,
				cloudClientId: 'legacy-client',
				cloudClientSecret: 'legacy-secret',
				cloudRedirectUrl: redirectUrl,
				cloudLegacyEnvironmentMigrated: true,
			}),
			expect.objectContaining({
				cloud_client_id: 'legacy-client',
				cloud_client_secret: 'legacy-secret',
				cloud_redirect_url: redirectUrl,
				cloud_legacy_environment_migrated: true,
			}),
		);
	});

	it('never replaces an existing admin-managed cloud configuration', () => {
		config.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), {
				cloudClientId: 'admin-client',
				cloudClientSecret: 'admin-secret',
				cloudRedirectUrl: redirectUrl,
			}),
		);

		service.migrate();

		expect(config.setPluginConfig).toHaveBeenCalledWith(
			DEVICES_HOMEY_PLUGIN_NAME,
			expect.objectContaining({ cloudLegacyEnvironmentMigrated: true }),
			{
				type: DEVICES_HOMEY_PLUGIN_NAME,
				cloud_legacy_environment_migrated: true,
			},
		);
	});

	it('does not consume incomplete legacy environment settings', () => {
		environmentValues[HOMEY_CLOUD_CLIENT_SECRET_ENV] = '';

		service.migrate();

		expect(config.setPluginConfig).not.toHaveBeenCalled();
	});

	it('does not reconsider environment settings after the migration marker is saved', () => {
		config.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), { cloudLegacyEnvironmentMigrated: true }),
		);

		service.migrate();

		expect(config.setPluginConfig).not.toHaveBeenCalled();
	});
});
