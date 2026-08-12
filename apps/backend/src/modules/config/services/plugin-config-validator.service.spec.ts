import { PluginConfigValidatorService } from './plugin-config-validator.service';

describe('PluginConfigValidatorService', () => {
	it('does not expose an unexpected validator error message', async () => {
		const service = new PluginConfigValidatorService();

		service.register({
			pluginType: 'mock',
			validate: () => Promise.reject(new Error('validator leaked sentinel-secret')),
		});

		await expect(service.validate('mock', { api_key: 'sentinel-secret' })).resolves.toEqual({
			valid: false,
			errors: [{ message: 'Configuration validation failed unexpectedly' }],
		});
	});
});
