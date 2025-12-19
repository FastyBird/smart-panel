import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import { useExtensions } from './useExtensions';

const mockExtensions: IExtension[] = [
	{
		type: 'devices-module',
		kind: ExtensionKind.MODULE,
		name: 'Devices Module',
		enabled: true,
		isCore: true,
		canToggleEnabled: false,
	},
	{
		type: 'auth-module',
		kind: ExtensionKind.MODULE,
		name: 'Auth Module',
		enabled: true,
		isCore: true,
		canToggleEnabled: false,
	},
	{
		type: 'pages-tiles-plugin',
		kind: ExtensionKind.PLUGIN,
		name: 'Pages Tiles Plugin',
		enabled: true,
		isCore: true,
		canToggleEnabled: true,
	},
];

const mockStore = {
	data: ref(Object.fromEntries(mockExtensions.map((ext) => [ext.type, ext]))),
	semaphore: ref({
		fetching: {
			items: false,
			item: [],
		},
		updating: [],
	}),
	fetch: vi.fn(),
};

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => mockStore),
	})),
}));

describe('useExtensions', () => {
	it('should return all extensions', () => {
		const { extensions } = useExtensions();

		expect(extensions.value).toHaveLength(3);
	});

	it('should return only modules', () => {
		const { modules } = useExtensions();

		expect(modules.value).toHaveLength(2);
		expect(modules.value.every((m) => m.kind === ExtensionKind.MODULE)).toBe(true);
	});

	it('should return only plugins', () => {
		const { plugins } = useExtensions();

		expect(plugins.value).toHaveLength(1);
		expect(plugins.value[0].kind).toBe(ExtensionKind.PLUGIN);
	});

	it('should indicate loading state', () => {
		const { areLoading } = useExtensions();

		expect(areLoading.value).toBe(false);
	});

	it('should call fetch on store', async () => {
		const { fetchExtensions } = useExtensions();

		await fetchExtensions();

		expect(mockStore.fetch).toHaveBeenCalled();
	});
});
