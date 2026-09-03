import { type ComputedRef, computed, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../config';
import type { IUseRemoteAccessUrls } from '../../remote-access';
import { McpCapability } from '../mcp.constants';
import type { IMcpConfigEditForm } from '../schemas/config.types';

import McpConfigForm from './mcp-config-form.vue';

let model: IMcpConfigEditForm;

const useConfigModuleEditFormMock = vi.fn();
const useRemoteAccessUrlsMock = vi.fn<() => IUseRemoteAccessUrls>();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../config', async () => {
	const actual = await vi.importActual('../../config');

	return {
		...actual,
		useConfigModuleEditForm: () => useConfigModuleEditFormMock(),
	};
});

vi.mock('../../remote-access', () => ({
	useRemoteAccessUrls: () => useRemoteAccessUrlsMock(),
}));

const mockRemoteAccessPrimary = (primary: string | null): void => {
	useRemoteAccessUrlsMock.mockReturnValue({
		internal: computed(() => null) as ComputedRef<string | null>,
		candidates: computed(() => []),
		external: computed(() => []),
		primary: computed(() => primary) as ComputedRef<string | null>,
		isLoading: computed(() => false),
		fetchUrls: vi.fn().mockResolvedValue(undefined),
	});
};

const findUseRemoteAccessUrlButton = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAll('button').find((button) => button.text().includes('mcpModule.config.oauth.useRemoteAccessUrl'));

describe('McpConfigForm', () => {
	beforeEach(() => {
		model = reactive({
			type: 'mcp',
			enabled: true,
			oauthEnabled: false,
			oauthPublicBaseUrl: null,
			capabilities: [McpCapability.read],
			allowedOrigins: [],
		}) as unknown as IMcpConfigEditForm;

		useConfigModuleEditFormMock.mockReset().mockReturnValue({
			formEl: ref(undefined),
			model,
			formChanged: ref(false),
			submit: vi.fn().mockResolvedValue('saved'),
			formResult: ref(FormResult.NONE),
		});

		useRemoteAccessUrlsMock.mockReset();
	});

	it('shows the "use remote access URL" button and fills the field on click when an HTTPS primary external URL exists', async () => {
		mockRemoteAccessPrimary('https://node.tailnet.ts.net');

		const wrapper = mount(McpConfigForm, {
			props: { config: { type: 'mcp', enabled: true } },
		});

		const button = findUseRemoteAccessUrlButton(wrapper);

		expect(button).toBeTruthy();
		expect(model.oauthPublicBaseUrl).toBeNull();

		await button!.trigger('click');

		expect(model.oauthPublicBaseUrl).toBe('https://node.tailnet.ts.net');
	});

	it('hides the button when the remote-access store has no primary external URL', () => {
		mockRemoteAccessPrimary(null);

		const wrapper = mount(McpConfigForm, {
			props: { config: { type: 'mcp', enabled: true } },
		});

		expect(findUseRemoteAccessUrlButton(wrapper)).toBeUndefined();
	});

	it('hides the button when the primary external URL is HTTP rather than HTTPS', () => {
		mockRemoteAccessPrimary('http://panel.example.com');

		const wrapper = mount(McpConfigForm, {
			props: { config: { type: 'mcp', enabled: true } },
		});

		expect(findUseRemoteAccessUrlButton(wrapper)).toBeUndefined();
	});
});
