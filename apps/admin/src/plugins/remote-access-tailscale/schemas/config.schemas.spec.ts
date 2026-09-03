import { describe, expect, it, vi } from 'vitest';

import { TailscaleConfigEditFormSchema } from './config.schemas';

// `./config.schemas` imports `ConfigPluginEditFormSchema` from the module's full barrel
// (`../../../modules/config`), which also re-exports Vue SFC components that pull in
// `system-config-form.vue` and crash outside a full app context. Mock the barrel down to just
// the one schema, imported from its own concrete path instead - mirrors
// devices-homey/schemas/config.schemas.spec.ts. `vi.mock` calls are hoisted above the import
// above regardless of source order, so this still takes effect before it runs.
vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'remote-access-tailscale-plugin',
	enabled: true,
	hostname: 'smart-panel',
	loginServer: 'https://controlplane.tailscale.com',
	acceptDns: true,
	acceptRoutes: false,
	advertiseTags: [],
	ssh: false,
	serveHttps: true,
	funnel: false,
	...overrides,
});

describe('TailscaleConfigEditFormSchema', () => {
	it('accepts a fully populated config', () => {
		expect(TailscaleConfigEditFormSchema.safeParse(createConfig()).success).toBe(true);
	});

	it('accepts advertised tags', () => {
		const result = TailscaleConfigEditFormSchema.safeParse(createConfig({ advertiseTags: ['tag:smart-panel', 'tag:remote-access'] }));

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.advertiseTags).toEqual(['tag:smart-panel', 'tag:remote-access']);
		}
	});

	it.each([
		['a blank hostname', { hostname: '' }],
		['a blank login server', { loginServer: '' }],
	])('rejects %s', (_label, overrides) => {
		expect(TailscaleConfigEditFormSchema.safeParse(createConfig(overrides)).success).toBe(false);
	});

	it('trims whitespace from the hostname and login server', () => {
		const result = TailscaleConfigEditFormSchema.safeParse(
			createConfig({ hostname: '  smart-panel  ', loginServer: '  https://controlplane.tailscale.com  ' })
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.hostname).toBe('smart-panel');
			expect(result.data.loginServer).toBe('https://controlplane.tailscale.com');
		}
	});

	it('never declares a field for a persisted auth key - only the config fields the backend documents', () => {
		expect(Object.keys(TailscaleConfigEditFormSchema.shape)).not.toContain('authKey');
	});
});
