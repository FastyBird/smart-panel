import type { FormInstance } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useConfigPluginEditForm } from '../../../modules/config/composables/useConfigPluginEditForm';
import { CONFIG_MODULE_NAME } from '../../../modules/config/config.constants';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelConfigEditFormSchema } from '../schemas/config.schemas';
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
	// The real plugin edit schema, not `{}` - `useConfigPluginEditForm.submit()` falls back to the
	// generic `ConfigPluginEditFormSchema` (only `type`/`enabled`) whenever this is missing, which
	// silently strips every Cloudflare-specific field (including `tunnelToken`) before `edit()` is
	// ever called - a test using that fallback could not tell "the token survived being sent, then
	// got cleared from the model" from "the token was never sent at all".
	elements: [{ type: 'config', schemas: { pluginConfigEditFormSchema: CloudflareTunnelConfigEditFormSchema } }],
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

// A factory, not a shared constant: `useConfigPluginEditForm()` does `reactive(config)` on the
// exact object passed in (never a clone), and `submit()`'s `reconcile()` step then mutates that
// same object in place. A single module-level `baseConfig` object reused (even via a shallow
// `{ ...baseConfig }` spread) would carry a previous test's mutations into the next one.
const buildConfig = (overrides: Partial<ICloudflareTunnelConfig> = {}): ICloudflareTunnelConfig =>
	({
		type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		enabled: true,
		publicHostname: 'panel.example.com',
		protocol: 'auto',
		tunnelTokenConfigured: false,
		...overrides,
	}) as unknown as ICloudflareTunnelConfig;

describe('Cloudflare Tunnel config form - tunnel token retention (real useConfigPluginEditForm)', () => {
	beforeEach(() => {
		mockEdit.mockReset();
	});

	it('drops the typed tunnel token from the live model once the backend confirms the save', async () => {
		const form = useConfigPluginEditForm<ICloudflareTunnelConfigEditForm>({ config: buildConfig() });

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

		// Proves the typed token actually reached the backend - a false pass here (the token
		// silently stripped by validation before ever being sent) would still leave the
		// assertions below looking green for the wrong reason.
		expect(mockEdit).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ tunnelToken: 'cf-tunnel-token-secret-value' }) })
		);

		// Left in place it would be sent again on the next save, and the field would still offer
		// no way to notice the token had already been stored.
		expect(form.model.tunnelToken).toBeUndefined();
		expect(form.model.tunnelTokenConfigured).toBe(true);
		expect(JSON.stringify(form.model)).not.toContain('cf-tunnel-token-secret-value');
	});

	it('rejects an explicit null token instead of silently clearing it - a tunnel cannot run without one, unlike an optional webhook URL', async () => {
		// `ConfigSecretInput`'s remove control stages `null` for fields where that means "clear
		// it" (e.g. an optional webhook URL). The tunnel token schema's own superRefine never
		// treats `null` as a valid "retain" or "provide" state (see config.schemas.ts), so this
		// documents the real, current contract: removal only happens through the plugin's own
		// `POST /reset` ("Remove tunnel"), never through this generic edit form.
		const form = useConfigPluginEditForm<ICloudflareTunnelConfigEditForm>({
			config: buildConfig({ tunnelTokenConfigured: true }),
		});

		form.formEl.value = validatedForm();
		form.model.tunnelToken = null;

		await expect(form.submit()).rejects.toThrow();

		expect(mockEdit).not.toHaveBeenCalled();
	});
});
