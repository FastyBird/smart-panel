import { type ComputedRef, computed } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { RemoteAccessModuleEndpointScope, RemoteAccessModuleProviderKind, RemoteAccessModuleProviderState } from '../../../openapi.constants';
import type { IUseRemoteAccessProviders } from '../composables/types';
import type { IRemoteAccessProvider } from '../store/remote-access-status.store.types';

import ProviderCards from './provider-cards.vue';

const tailscaleProvider: IRemoteAccessProvider = {
	type: 'remote-access-tailscale',
	kind: RemoteAccessModuleProviderKind.mesh,
	capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: true },
	state: RemoteAccessModuleProviderState.connected,
	endpoints: [{ url: 'https://node.tailnet.ts.net', scope: RemoteAccessModuleEndpointScope.private, https: true, label: 'Tailscale (HTTPS)' }],
	message: null,
	details: {},
	proxyAddresses: [],
	advisories: [],
	updatedAt: '2026-01-01T00:00:00.000Z',
};

const useRemoteAccessProvidersMock = vi.fn<() => IUseRemoteAccessProviders>();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
	}),
}));

vi.mock('../composables', () => ({
	useRemoteAccessProviders: () => useRemoteAccessProvidersMock(),
}));

describe('ProviderCards', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	const mockComposable = (providers: IRemoteAccessProvider[], getElement: IUseRemoteAccessProviders['getElement']): void => {
		useRemoteAccessProvidersMock.mockReturnValue({
			providers: computed(() => providers) as ComputedRef<IRemoteAccessProvider[]>,
			isLoading: computed(() => false),
			fetchProviders: vi.fn(),
			getElement,
		});
	};

	it('renders the empty state when no providers are registered', () => {
		mockComposable([], () => undefined);

		const wrapper = mount(ProviderCards);

		expect(wrapper.text()).toContain('remoteAccessModule.texts.noProviders');
	});

	it('renders the plugin-supplied provider card when the owning plugin registers one', () => {
		const ProviderCardStub = {
			props: ['provider'],
			template: '<div class="plugin-provider-card">{{ provider.type }}</div>',
		};

		mockComposable([tailscaleProvider], (type) =>
			type === 'remote-access-tailscale'
				? ({ type: 'provider', modules: ['remote-access-module'], components: { providerCard: ProviderCardStub } } as never)
				: undefined
		);

		const wrapper = mount(ProviderCards);

		expect(wrapper.find('.plugin-provider-card').exists()).toBe(true);
		expect(wrapper.find('.plugin-provider-card').text()).toBe('remote-access-tailscale');
	});

	it('falls back to a generic card with state, endpoints and message when the plugin has no element', () => {
		mockComposable(
			[
				{
					...tailscaleProvider,
					state: RemoteAccessModuleProviderState.setup_required,
					message: 'Daemon stopped',
				},
			],
			() => undefined
		);

		const wrapper = mount(ProviderCards);

		expect(wrapper.find('.plugin-provider-card').exists()).toBe(false);
		expect(wrapper.text()).toContain('remote-access-tailscale');
		expect(wrapper.text()).toContain('remoteAccessModule.status.setup-required');
		expect(wrapper.text()).toContain('Daemon stopped');
		expect(wrapper.text()).toContain('https://node.tailnet.ts.net');
	});
});
