import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { RemoteAccessModuleEndpointScope } from '../../../openapi.constants';
import type { IRemoteAccessStatus } from '../store/remote-access-status.store.types';

import { useRemoteAccessUrls } from './useRemoteAccessUrls';

// Ranking per the backend contract: HTTPS before HTTP, public before private, then registration
// order. The composable must render this order as given, never re-sort it client-side.
const rankedStatus: IRemoteAccessStatus = {
	enabled: true,
	providers: [],
	urls: {
		internal: 'http://localhost:3000',
		candidates: ['http://192.168.1.5:3000', 'http://smart-panel.local:3000'],
		external: [
			{ url: 'https://node.tailnet.ts.net', scope: RemoteAccessModuleEndpointScope.private, https: true, label: 'Tailscale (HTTPS)' },
			{ url: 'https://panel.example.com', scope: RemoteAccessModuleEndpointScope.public, https: true, label: 'Manual external URL' },
			{ url: 'http://panel.example.com', scope: RemoteAccessModuleEndpointScope.public, https: false, label: 'Manual external URL (HTTP)' },
		],
		primary: 'https://node.tailnet.ts.net',
	},
	advisories: [],
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useRemoteAccessUrls', () => {
	let mockStore: {
		get: ReturnType<typeof vi.fn>;
		$id: string;
		data: Ref<IRemoteAccessStatus | null>;
		semaphore: Ref<{ getting: boolean }>;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockStore = {
			get: vi.fn(),
			$id: 'remote_access_module-status',
			data: ref(null),
			semaphore: ref({ getting: false }),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns empty defaults before the first fetch', () => {
		const { internal, candidates, external, primary } = useRemoteAccessUrls();

		expect(internal.value).toBeNull();
		expect(candidates.value).toEqual([]);
		expect(external.value).toEqual([]);
		expect(primary.value).toBeNull();
	});

	it('exposes the external endpoints in the exact order the backend ranked them', () => {
		mockStore.data.value = rankedStatus;

		const { external } = useRemoteAccessUrls();

		expect(external.value.map((endpoint) => endpoint.url)).toEqual([
			'https://node.tailnet.ts.net',
			'https://panel.example.com',
			'http://panel.example.com',
		]);
	});

	it('exposes the primary URL as the top-ranked entry', () => {
		mockStore.data.value = rankedStatus;

		const { primary, external } = useRemoteAccessUrls();

		expect(primary.value).toBe('https://node.tailnet.ts.net');
		expect(external.value[0]!.url).toBe(primary.value);
	});

	it('exposes internal URL and LAN candidates separately from external endpoints', () => {
		mockStore.data.value = rankedStatus;

		const { internal, candidates } = useRemoteAccessUrls();

		expect(internal.value).toBe('http://localhost:3000');
		expect(candidates.value).toEqual(['http://192.168.1.5:3000', 'http://smart-panel.local:3000']);
	});

	it('delegates fetchUrls to the store', async () => {
		const { fetchUrls } = useRemoteAccessUrls();

		await fetchUrls();

		expect(mockStore.get).toHaveBeenCalled();
	});
});
