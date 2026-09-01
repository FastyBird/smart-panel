/* eslint-disable vue/one-component-per-file */
import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { ExtensionsModuleServiceOwnerKind } from '../../../openapi.constants';

import ViewExtensions from './view-extensions.vue';

type ViewExtensionsInstance = ComponentPublicInstance<{
	activeTab: 'extensions' | 'services';
	activeServiceKind: ExtensionsModuleServiceOwnerKind;
}>;

const mocks = vi.hoisted(() => ({
	route: {
		query: {} as Record<string, string>,
	},
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	fetchExtensions: vi.fn().mockResolvedValue(undefined),
	fetchServices: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-meta', () => ({
	useMeta: vi.fn(),
}));

vi.mock('vue-router', () => ({
	useRoute: () => mocks.route,
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
		resolve: mocks.routerResolve,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent, ref } = await import('vue');

	return {
		AppBar: defineComponent({ template: '<div><slot /></div>' }),
		AppBarButton: defineComponent({ template: '<button><slot /></button>' }),
		AppBarButtonAlign: {
			LEFT: 'left',
			RIGHT: 'right',
		},
		AppBarHeading: defineComponent({ template: '<div><slot /></div>' }),
		AppBreadcrumbs: defineComponent({ template: '<div />' }),
		ViewHeader: defineComponent({ template: '<div />' }),
		useBreakpoints: () => ({
			isMDDevice: ref(true),
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');

	return {
		ListExtensions: defineComponent({ template: '<div />' }),
		ListExtensionsAdjust: defineComponent({ template: '<div />' }),
		ServicesList: defineComponent({
			props: {
				activeKind: {
					type: String,
					required: true,
				},
			},
			template: '<div />',
		}),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	return {
		useExtensionActions: () => ({
			toggleEnabled: vi.fn(),
			bulkEnable: vi.fn(),
			bulkDisable: vi.fn(),
		}),
		useExtensionsDataSource: () => ({
			extensions: ref([]),
			extensionsPaginated: ref([]),
			totalRows: ref(0),
			areLoading: ref(false),
			fetchExtensions: mocks.fetchExtensions,
			filters: ref({}),
			filtersActive: ref(false),
			paginateSize: ref(10),
			paginatePage: ref(1),
			sortBy: ref(undefined),
			sortDir: ref(null),
			viewMode: ref('table'),
			resetFilter: vi.fn(),
		}),
		useServiceActions: () => ({
			startService: vi.fn(),
			stopService: vi.fn(),
			restartService: vi.fn(),
			isActing: vi.fn().mockReturnValue(false),
		}),
		useServices: () => ({
			services: ref([]),
			areLoading: ref(false),
			fetchServices: mocks.fetchServices,
		}),
	};
});

describe('ViewExtensions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.route.query = {};
	});

	it('coordinates the primary tab with the default service kind in the query', async () => {
		const wrapper = shallowMount(ViewExtensions);
		const vm = wrapper.vm as unknown as ViewExtensionsInstance;

		expect(vm.activeTab).toBe('extensions');
		expect(vm.activeServiceKind).toBe(ExtensionsModuleServiceOwnerKind.module);
		expect(mocks.fetchServices).not.toHaveBeenCalled();

		vm.activeTab = 'services';
		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledWith({
			query: {
				tab: 'services',
				serviceKind: ExtensionsModuleServiceOwnerKind.module,
			},
		});
	});

	it('restores a linked service tab and loads services immediately', async () => {
		mocks.route.query = {
			tab: 'services',
			serviceKind: ExtensionsModuleServiceOwnerKind.plugin,
			search: 'retained',
		};

		const wrapper = shallowMount(ViewExtensions);
		const vm = wrapper.vm as unknown as ViewExtensionsInstance;
		await flushPromises();

		expect(vm.activeTab).toBe('services');
		expect(vm.activeServiceKind).toBe(ExtensionsModuleServiceOwnerKind.plugin);
		expect(mocks.fetchServices).toHaveBeenCalledOnce();

		vm.activeServiceKind = ExtensionsModuleServiceOwnerKind.module;

		expect(mocks.routerReplace).toHaveBeenCalledWith({
			query: {
				tab: 'services',
				serviceKind: ExtensionsModuleServiceOwnerKind.module,
				search: 'retained',
			},
		});
	});

	it('adds the default service kind to incomplete service links', async () => {
		mocks.route.query = { tab: 'services' };

		shallowMount(ViewExtensions);
		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledWith({
			query: {
				tab: 'services',
				serviceKind: ExtensionsModuleServiceOwnerKind.module,
			},
		});
	});
});
