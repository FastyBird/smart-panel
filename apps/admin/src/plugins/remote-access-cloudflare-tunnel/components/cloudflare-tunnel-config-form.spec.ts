import { type Reactive, nextTick, reactive, ref } from 'vue';

import { ElForm, type FormRules } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../../modules/config';
import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import type { ICloudflareTunnelConfigEditForm } from '../schemas/config.types';

import CloudflareTunnelConfigForm from './cloudflare-tunnel-config-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

let mockModel: Reactive<ICloudflareTunnelConfigEditForm>;

vi.mock('../../../modules/config', async () => {
	const actual = await vi.importActual<typeof import('../../../modules/config')>('../../../modules/config');

	return {
		...actual,
		useConfigPluginEditForm: () => ({
			formEl: ref(undefined),
			model: mockModel,
			formChanged: ref(false),
			submit: vi.fn(),
			formResult: ref(actual.FormResult.NONE),
		}),
	};
});

const buildModel = (overrides: Partial<ICloudflareTunnelConfigEditForm> = {}): Reactive<ICloudflareTunnelConfigEditForm> =>
	reactive({
		type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		enabled: true,
		publicHostname: null,
		protocol: 'auto',
		tunnelToken: undefined,
		tunnelTokenConfigured: false,
		...overrides,
	}) as Reactive<ICloudflareTunnelConfigEditForm>;

const factory = () =>
	mount(CloudflareTunnelConfigForm, {
		props: {
			config: { type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } as unknown as IConfigPlugin,
			remoteFormResult: FormResult.NONE,
		},
	});

type Callback = (error?: string | Error) => void;
type Validator = (rule: unknown, value: unknown, callback: Callback) => void;

const getValidator = (wrapper: ReturnType<typeof factory>, field: 'publicHostname' | 'tunnelToken'): Validator => {
	const rules = wrapper.findComponent(ElForm).props('rules') as FormRules<ICloudflareTunnelConfigEditForm>;
	const rule = rules[field];
	const first = Array.isArray(rule) ? rule[0] : rule;

	if (!first || typeof first.validator !== 'function') {
		throw new Error(`${field} rule validator not found`);
	}

	return first.validator as Validator;
};

const runValidator = (validator: Validator, value: unknown): Promise<void> =>
	new Promise<void>((resolve, reject) => {
		validator({}, value, (error) => (error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve()));
	});

describe('CloudflareTunnelConfigForm', () => {
	describe('publicHostname validation', () => {
		it('accepts a blank hostname (never configured yet)', async () => {
			mockModel = buildModel();
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'publicHostname'), '')).resolves.toBeUndefined();
		});

		it('accepts a valid hostname', async () => {
			mockModel = buildModel();
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'publicHostname'), 'panel.example.com')).resolves.toBeUndefined();
		});

		it('rejects a hostname carrying a scheme', async () => {
			mockModel = buildModel();
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'publicHostname'), 'https://panel.example.com')).rejects.toThrow(
				'remoteAccessCloudflareTunnelPlugin.fields.config.publicHostname.invalid'
			);
		});
	});

	describe('tunnelToken validation', () => {
		it('rejects a blank token when none is configured yet', async () => {
			mockModel = buildModel({ tunnelTokenConfigured: false, tunnelToken: undefined });
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'tunnelToken'), undefined)).rejects.toThrow(
				'remoteAccessCloudflareTunnelPlugin.fields.config.tunnelToken.validation.required'
			);
		});

		it('accepts a blank token once one is already configured (retained)', async () => {
			mockModel = buildModel({ tunnelTokenConfigured: true, tunnelToken: undefined });
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'tunnelToken'), undefined)).resolves.toBeUndefined();
		});

		it('accepts a freshly typed token', async () => {
			mockModel = buildModel({ tunnelTokenConfigured: false, tunnelToken: 'a-fresh-token' });
			const wrapper = factory();
			await nextTick();

			await expect(runValidator(getValidator(wrapper, 'tunnelToken'), 'a-fresh-token')).resolves.toBeUndefined();
		});

		it('renders the "configured" hint once a token is stored', async () => {
			mockModel = buildModel({ tunnelTokenConfigured: true, tunnelToken: undefined });
			const wrapper = factory();
			await nextTick();

			expect(wrapper.text()).toContain('configModule.texts.secret.stored');
		});
	});
});
