import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import { defaultExtensionsFilter, defaultExtensionsSort, useExtensionsDataSource } from './useExtensionsDataSource';

const mockExtensions: IExtension[] = [
	{
		type: 'devices-module',
		kind: ExtensionKind.MODULE,
		name: 'Devices Module',
		description: 'Device management',
		enabled: true,
		isCore: true,
		canToggleEnabled: false,
	},
	{
		type: 'auth-module',
		kind: ExtensionKind.MODULE,
		name: 'Auth Module',
		description: 'Authentication',
		enabled: false,
		isCore: true,
		canToggleEnabled: true,
	},
	{
		type: 'pages-tiles-plugin',
		kind: ExtensionKind.PLUGIN,
		name: 'Pages Tiles Plugin',
		description: 'Dashboard tiles',
		enabled: true,
		isCore: true,
		canToggleEnabled: true,
	},
	{
		type: 'external-plugin',
		kind: ExtensionKind.PLUGIN,
		name: 'External Plugin',
		description: 'Third party addon',
		enabled: true,
		isCore: false,
		canToggleEnabled: true,
	},
];

const mockFilters = ref({ ...defaultExtensionsFilter });
const mockPagination = ref({ page: 1, size: 10 });
const mockSort = ref([defaultExtensionsSort]);
const mockViewMode = ref<'table' | 'cards'>('table');

const mockStore = {
	data: Object.fromEntries(mockExtensions.map((ext) => [ext.type, ext])),
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
	useListQuery: vi.fn(() => ({
		filters: mockFilters,
		pagination: mockPagination,
		sort: mockSort,
		viewMode: mockViewMode,
		reset: vi.fn(() => {
			mockFilters.value = { ...defaultExtensionsFilter };
		}),
	})),
}));

describe('useExtensionsDataSource', () => {
	beforeEach(() => {
		mockFilters.value = { ...defaultExtensionsFilter };
		mockPagination.value = { page: 1, size: 10 };
		mockSort.value = [defaultExtensionsSort];
		mockViewMode.value = 'table';
	});

	describe('basic filtering', () => {
		it('should return all extensions without filters', () => {
			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(4);
		});

		it('should return only modules when filtered by MODULE kind', () => {
			mockFilters.value = { ...defaultExtensionsFilter, kind: ExtensionKind.MODULE };

			const { modules } = useExtensionsDataSource();

			expect(modules.value).toHaveLength(2);
			expect(modules.value.every((m) => m.kind === ExtensionKind.MODULE)).toBe(true);
		});

		it('should return only plugins when filtered by PLUGIN kind', () => {
			mockFilters.value = { ...defaultExtensionsFilter, kind: ExtensionKind.PLUGIN };

			const { plugins } = useExtensionsDataSource();

			expect(plugins.value).toHaveLength(2);
			expect(plugins.value.every((p) => p.kind === ExtensionKind.PLUGIN)).toBe(true);
		});
	});

	describe('enabled filter', () => {
		it('should return only enabled extensions', () => {
			mockFilters.value = { ...defaultExtensionsFilter, enabled: 'enabled' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(3);
			expect(extensions.value.every((e) => e.enabled)).toBe(true);
		});

		it('should return only disabled extensions', () => {
			mockFilters.value = { ...defaultExtensionsFilter, enabled: 'disabled' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('auth-module');
		});
	});

	describe('core filter', () => {
		it('should return only core extensions', () => {
			mockFilters.value = { ...defaultExtensionsFilter, isCore: 'core' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(3);
			expect(extensions.value.every((e) => e.isCore)).toBe(true);
		});

		it('should return only addon (non-core) extensions', () => {
			mockFilters.value = { ...defaultExtensionsFilter, isCore: 'addon' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('external-plugin');
		});
	});

	describe('search filter', () => {
		it('should filter by type', () => {
			mockFilters.value = { ...defaultExtensionsFilter, search: 'devices' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('devices-module');
		});

		it('should filter by name', () => {
			mockFilters.value = { ...defaultExtensionsFilter, search: 'Auth' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('auth-module');
		});

		it('should filter by description', () => {
			mockFilters.value = { ...defaultExtensionsFilter, search: 'tiles' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('pages-tiles-plugin');
		});

		it('should be case insensitive', () => {
			mockFilters.value = { ...defaultExtensionsFilter, search: 'DEVICES' };

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
		});
	});

	describe('combined filters', () => {
		it('should apply multiple filters together', () => {
			mockFilters.value = {
				search: undefined,
				kind: ExtensionKind.PLUGIN,
				enabled: 'enabled',
				isCore: 'core',
			};

			const { extensions } = useExtensionsDataSource();

			expect(extensions.value).toHaveLength(1);
			expect(extensions.value[0].type).toBe('pages-tiles-plugin');
		});
	});

	describe('filtersActive', () => {
		it('should be false when using default filters', () => {
			const { filtersActive } = useExtensionsDataSource();

			expect(filtersActive.value).toBe(false);
		});

		it('should be true when search is set', () => {
			mockFilters.value = { ...defaultExtensionsFilter, search: 'test' };

			const { filtersActive } = useExtensionsDataSource();

			expect(filtersActive.value).toBe(true);
		});

		it('should be true when kind filter is changed', () => {
			mockFilters.value = { ...defaultExtensionsFilter, kind: ExtensionKind.MODULE };

			const { filtersActive } = useExtensionsDataSource();

			expect(filtersActive.value).toBe(true);
		});
	});

	describe('loading state', () => {
		it('should indicate loading state from store', () => {
			const { areLoading } = useExtensionsDataSource();

			expect(areLoading.value).toBe(false);
		});
	});

	describe('fetchExtensions', () => {
		it('should call store fetch', async () => {
			const { fetchExtensions } = useExtensionsDataSource();

			await fetchExtensions();

			expect(mockStore.fetch).toHaveBeenCalled();
		});
	});
});
