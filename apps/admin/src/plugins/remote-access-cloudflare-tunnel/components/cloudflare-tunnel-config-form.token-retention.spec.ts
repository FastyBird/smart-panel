import type { FormInstance } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { useConfigPluginEditForm } from '../../../modules/config/composables/useConfigPluginEditForm';
import { CONFIG_MODULE_NAME } from '../../../modules/config/config.constants';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import type { ICloudflareTunnelConfigEditForm } from '../schemas/config.types';
import type { ICloudflareTunnelConfig } from '../store/config.store.types';

// This exercises the REAL `useConfigPluginEditForm` composable (the one
// `cloudflare-tunnel-config-form.vue` actually calls) end to end, rather than mounting the SFC:
// `ElForm.validate()`'s real async-validator plumbing does not settle reliably under Vitest's SSR
// module loading (see the same caveat noted in `webhook-config-form.spec.ts`), so - exactly like
// `useConfigPluginEditForm.spec.ts`'s own "after a save" tests - `formEl.value` is a stub with a
// `validate` that resolves `true` directly. What is under test here is genuinely the composable's
// `reconcile()` behaviour operating on this plugin's own config shape, proving the write-only
// tunnel token the operator typed does not survive a successful save.

const mockEdit = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({ edit: mockEdit }),
		}),
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
		useLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warning: vi.fn(), log: vi.fn(), debug: vi.fn() })),
	};
});

const mockPlugin = {
	type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
	source: 'source',
	name: 'Cloudflare Tunnel',
	description: 'Description',
	links: { documentation: '', devDocumentation: '', bugsTracking: '' },
	elements: [{ type: 'config', schemas: {} }],
	isCore: false,
	modules: [CONFIG_MODULE_NAME],
};

vi.mock('../../../modules/config/composables/usePlugins', () => ({
	usePlugins: () => ({
		getByName: (name: string) => (name === REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME ? mockPlugin : undefined),
	}),
}));

const validatedForm = (): FormInstance =>
	({
		clearValidate: vi.fn(),
		validate: vi.fn().mockResolvedValue(true),
	}) as unknown as FormInstance;

const baseConfig: ICloudflareTunnelConfig = {
	type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
	enabled: true,
	publicHostname: 'panel.example.com',
	protocol: 'auto',
	tunnelTokenConfigured: false,
} as unknown as ICloudflareTunnelConfig;

describe('Cloudflare Tunnel config form - tunnel token retention (real useConfigPluginEditForm)', () => {
	it('drops the typed tunnel token from the live model once the backend confirms the save', async () => {
		const form = useConfigPluginEditForm<ICloudflareTunnelConfigEditForm>({ config: baseConfig });

		form.formEl.value = validatedForm();
		form.model.tunnelToken = 'cf-tunnel-token-secret-value';

		mockEdit.mockResolvedValueOnce({
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			enabled: true,
			publicHostname: 'panel.example.com',
			protocol: 'auto',
			tunnelTokenConfigured: true,
			// Never in the response - the backend redacts it (D9's write-only secret contract).
		});

		await form.submit();

		// Left in place it would be sent again on the next save, and the field would still offer
		// no way to notice the token had already been stored.
		expect(form.model.tunnelToken).toBeUndefined();
		expect(form.model.tunnelTokenConfigured).toBe(true);
		expect(JSON.stringify(form.model)).not.toContain('cf-tunnel-token-secret-value');
	});

	it('drops a staged removal (null) once the backend confirms the token was cleared', async () => {
		const form = useConfigPluginEditForm<ICloudflareTunnelConfigEditForm>({
			config: { ...baseConfig, tunnelTokenConfigured: true } as unknown as ICloudflareTunnelConfig,
		});

		form.formEl.value = validatedForm();
		// What `ConfigSecretInput`'s remove control stages: null is the one value that asks for a removal.
		form.model.tunnelToken = null;

		mockEdit.mockResolvedValueOnce({
			type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			enabled: true,
			publicHostname: 'panel.example.com',
			protocol: 'auto',
			tunnelTokenConfigured: false,
		});

		await form.submit();

		expect(form.model.tunnelToken).toBeUndefined();
		expect(form.model.tunnelTokenConfigured).toBe(false);
	});
});
