import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { McpOAuthScope } from '../mcp.constants';

import ViewMcpOAuthConsent from './view-mcp-oauth-consent.vue';

const mocks = vi.hoisted(() => ({
	load: vi.fn(),
	approve: vi.fn(),
	deny: vi.fn(),
}));

const interaction = {
	action: 'consent' as const,
	installationName: 'Kitchen panel',
	installationId: '10000000-0000-4000-8000-000000000001',
	clientIdentifier: 'codex-client',
	clientName: 'Codex',
	redirectUri: 'http://127.0.0.1:1455/callback',
	requestedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE],
	accessExpiresInSeconds: 600,
	maximumGrantExpiresInDays: 90,
	physicalDeviceWarning: true,
};

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { interaction: 'interaction-id' } }) }));
vi.mock('../../../common', () => ({
	ViewHeader: { name: 'ViewHeader', template: '<header />' },
}));
vi.mock('../composables/useMcpOAuthInteraction', () => ({
	useMcpOAuthInteraction: () => ({
		interaction: ref(interaction),
		loading: ref(false),
		working: ref(false),
		error: ref(null),
		load: mocks.load,
		approve: mocks.approve,
		deny: mocks.deny,
	}),
}));

describe('ViewMcpOAuthConsent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.load.mockResolvedValue(interaction);
	});

	it('shows installation, client, redirect, expiry, scopes, and the physical-device warning', async () => {
		const wrapper = shallowMount(ViewMcpOAuthConsent, {
			global: {
				stubs: {
					ElAlert: {
						name: 'ElAlert',
						props: ['title', 'description'],
						template: '<div class="alert">{{ title }} {{ description }}</div>',
					},
					ElCard: { template: '<section><slot /></section>' },
					ElForm: { template: '<form><slot /></form>' },
					ElFormItem: { template: '<div><slot /></div>' },
					ElCheckboxGroup: {
						name: 'ElCheckboxGroup',
						props: ['modelValue'],
						template: '<div><slot /></div>',
					},
					ElCheckbox: { template: '<label><slot /></label>' },
					ElInputNumber: true,
					ElButton: { template: '<button><slot /></button>' },
				},
				directives: { loading: {} },
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain('Kitchen panel');
		expect(wrapper.text()).toContain('Codex');
		expect(wrapper.text()).toContain('http://127.0.0.1:1455/callback');
		expect(wrapper.findComponent({ name: 'ElAlert' }).exists()).toBe(true);
		expect(wrapper.text()).toContain('mcpModule.oauthConsent.physicalWarning');
		expect(mocks.load).toHaveBeenCalledWith('interaction-id');
		expect(wrapper.findComponent({ name: 'ElCheckboxGroup' }).props('modelValue')).toEqual([McpOAuthScope.READ]);
	});
});
