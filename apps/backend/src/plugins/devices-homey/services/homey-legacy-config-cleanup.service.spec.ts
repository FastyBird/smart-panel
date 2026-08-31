import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyLegacyConfigCleanupService } from './homey-legacy-config-cleanup.service';

describe('HomeyLegacyConfigCleanupService', () => {
	it('preserves local settings and disables a formerly remote configuration', () => {
		const current = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: 'stored-local-key',
			legacyConnectionMode: 'cloud',
			legacyRemoteClientSecret: 'obsolete-secret',
		});
		const config = {
			getPluginConfig: jest.fn().mockReturnValue(current),
			setPluginConfig: jest.fn(),
		};
		const service = new HomeyLegacyConfigCleanupService(config as unknown as ConfigService);

		service.cleanup();

		expect(config.setPluginConfig).toHaveBeenCalledWith(
			DEVICES_HOMEY_PLUGIN_NAME,
			expect.objectContaining({
				enabled: false,
				url: 'http://homey.local:4859',
				apiKey: 'stored-local-key',
			}),
			expect.any(Object),
		);
		const submitted = (
			config.setPluginConfig.mock.calls[0] as unknown as [string, unknown, Record<string, unknown>]
		)[2];
		expect(submitted).not.toHaveProperty('mode');
		expect(submitted).not.toHaveProperty('cloud_client_secret');
	});

	it('does not rewrite a current local-only configuration', () => {
		const config = {
			getPluginConfig: jest.fn().mockReturnValue(new HomeyConfigModel()),
			setPluginConfig: jest.fn(),
		};
		const service = new HomeyLegacyConfigCleanupService(config as unknown as ConfigService);

		service.cleanup();

		expect(config.setPluginConfig).not.toHaveBeenCalled();
	});
});
