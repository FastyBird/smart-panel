import { describe, expect, it, vi } from 'vitest';

import { CloudflareTunnelConfigEditFormSchema } from './config.schemas';

// `./config.schemas` imports `ConfigPluginEditFormSchema` from the module's full barrel
// (`../../../modules/config`), which also re-exports Vue SFC components that pull in
// `system-config-form.vue` and crash outside a full app context. Mock the barrel down to just the
// one schema, imported from its own concrete path instead - mirrors
// `devices-homey/schemas/config.schemas.spec.ts` and the Tailscale plugin's own equivalent spec.
vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'remote-access-cloudflare-tunnel-plugin',
	enabled: true,
	publicHostname: 'panel.example.com',
	protocol: 'auto',
	tunnelToken: 'a-fresh-token',
	tunnelTokenConfigured: false,
	...overrides,
});

describe('CloudflareTunnelConfigEditFormSchema', () => {
	it('accepts a fully populated config', () => {
		expect(CloudflareTunnelConfigEditFormSchema.safeParse(createConfig()).success).toBe(true);
	});

	it('accepts a null hostname (clearing it)', () => {
		const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ publicHostname: null }));

		expect(result.success).toBe(true);
	});

	it('normalises a blank hostname to null', () => {
		const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ publicHostname: '   ' }));

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.publicHostname).toBeNull();
		}
	});

	it('trims a padded hostname instead of rejecting it — the form field validates the trimmed value, so the schema must accept what the field already accepted', () => {
		const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ publicHostname: '  panel.example.com  ' }));

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.publicHostname).toBe('panel.example.com');
		}
	});

	it('rejects a hostname with a scheme', () => {
		const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ publicHostname: 'https://panel.example.com' }));

		expect(result.success).toBe(false);
	});

	it('rejects a bare hostname with no TLD label', () => {
		const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ publicHostname: 'panel' }));

		expect(result.success).toBe(false);
	});

	describe('tunnel token requirement', () => {
		it('accepts a retained token (blank input, already configured)', () => {
			const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ tunnelToken: undefined, tunnelTokenConfigured: true }));

			expect(result.success).toBe(true);
		});

		it('rejects a blank token when none is configured yet', () => {
			const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ tunnelToken: undefined, tunnelTokenConfigured: false }));

			expect(result.success).toBe(false);
		});

		it('rejects an explicit removal (null) of the token', () => {
			const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ tunnelToken: null, tunnelTokenConfigured: true }));

			expect(result.success).toBe(false);
		});

		it('accepts a freshly typed token', () => {
			const result = CloudflareTunnelConfigEditFormSchema.safeParse(createConfig({ tunnelToken: 'a-new-token', tunnelTokenConfigured: true }));

			expect(result.success).toBe(true);
		});
	});
});
