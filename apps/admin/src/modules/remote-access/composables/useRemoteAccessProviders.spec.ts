import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type IPlugin, injectPluginsManager, injectStoresManager } from '../../../common';
import { RemoteAccessModuleProviderKind, RemoteAccessModuleProviderState } from '../../../openapi.constants';
import type { IRemoteAccessProviderPluginsComponents } from '../remote-access.types';
import type { IRemoteAccessProvider, IRemoteAccessStatus } from '../store/remote-access-status.store.types';

import { useRemoteAccessProviders } from './useRemoteAccessProviders';

const mockProvider: IRemoteAccessProvider = {
	type: 'remote-access-tailscale',
	kind: RemoteAccessModuleProviderKind.mesh,
	capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: true },
	state: RemoteAccessModuleProviderState.connected,
	endpoints: [],
	message: null,
	details: {},
	proxyAddresses: [],
	advisories: [],
	updatedAt: '2026-01-01T00:00:00.000Z',
};

const statusWithProvider: IRemoteAccessStatus = {
	enabled: true,
	providers: [mockProvider],
	urls: { internal: 'http://localhost:3000', candidates: [], external: [], primary: null },
	advisories: [],
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		injectPluginsManager: vi.fn(),
	};
});

describe('useRemoteAccessProviders', () => {
	let mockStore: {
		get: ReturnType<typeof vi.fn>;
		$id: string;
		data: Ref<IRemoteAccessStatus | null>;
		semaphore: Ref<{ getting: boolean }>;
	};

	const mockGetPlugins = vi.fn<() => IPlugin<IRemoteAccessProviderPluginsComponents>[]>();

	beforeEach(() => {
		setActivePinia(createPinia());

		mockStore = {
			get: vi.fn(),
			$id: 'remote_access_module-status',
			data: ref(null),
			semaphore: ref({ getting: false }),
		};

		mockGetPlugins.mockReset();
		mockGetPlugins.mockReturnValue([]);

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		(injectPluginsManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getPlugins: mockGetPlugins,
		});
	});

	it('returns no providers before the first fetch', () => {
		const { providers } = useRemoteAccessProviders();

		expect(providers.value).toEqual([]);
	});

	it('exposes every provider from the loaded status', () => {
		mockStore.data.value = statusWithProvider;

		const { providers } = useRemoteAccessProviders();

		expect(providers.value).toEqual([mockProvider]);
	});

	it('finds the plugin element for a provider whose plugin registers one', () => {
		const providerCardStub = {} as never;

		mockGetPlugins.mockReturnValue([
			{
				type: 'remote-access-tailscale',
				source: 'static',
				name: 'Tailscale',
				description: 'Tailscale mesh VPN',
				links: { documentation: '', devDocumentation: '', bugsTracking: '' },
				isCore: true,
				modules: ['remote-access-module'],
				elements: [
					{
						type: 'provider',
						modules: ['remote-access-module'],
						components: { providerCard: providerCardStub },
					},
				],
			},
		]);

		const { getElement } = useRemoteAccessProviders();

		const element = getElement('remote-access-tailscale');

		expect(element?.components?.providerCard).toBe(providerCardStub);
	});

	it('returns undefined when no plugin registers an element for the provider type', () => {
		const { getElement } = useRemoteAccessProviders();

		expect(getElement('remote-access-tailscale')).toBeUndefined();
	});

	it('returns undefined when a matching plugin exists but its element is not scoped to this module', () => {
		mockGetPlugins.mockReturnValue([
			{
				type: 'remote-access-tailscale',
				source: 'static',
				name: 'Tailscale',
				description: 'Tailscale mesh VPN',
				links: { documentation: '', devDocumentation: '', bugsTracking: '' },
				isCore: true,
				elements: [
					{
						type: 'provider',
						modules: ['some-other-module'],
						components: { providerCard: {} as never },
					},
				],
			},
		]);

		const { getElement } = useRemoteAccessProviders();

		expect(getElement('remote-access-tailscale')).toBeUndefined();
	});

	it('delegates fetchProviders to the store', async () => {
		const { fetchProviders } = useRemoteAccessProviders();

		await fetchProviders();

		expect(mockStore.get).toHaveBeenCalled();
	});
});
