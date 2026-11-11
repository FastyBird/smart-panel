import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { ListAutomations, ListAutomationsAdjust } from '../components/components';

import ViewAutomations from './view-automations.vue';

const mocks = vi.hoisted(() => ({
	fetchAutomations: vi.fn(),
	fetchSpaces: vi.fn(),
	// Assigned by the mock factories below, which is the first place `ref` is available
	loadFailed: null as unknown as Ref<boolean>,
	isLGDevice: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ name: 'automations_module-automations', path: '/automations', matched: [] }),
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		resolve: (to: unknown) => to,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref } = await import('vue');

	mocks.isLGDevice = ref<boolean>(true);

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots['button-right']?.(), slots.extra?.()]);
		},
	});

	return {
		AppBar: StubComponent,
		AppBarButton: StubComponent,
		AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right', BACK: 'back', NONE: 'none' },
		AppBarHeading: StubComponent,
		AppBreadcrumbs: StubComponent,
		ViewError: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: mocks.isLGDevice,
			isLGDevice: mocks.isLGDevice,
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListAutomations: defineVueComponent({
			name: 'ListAutomations',
			props: {
				loading: { type: Boolean, default: false },
				loadFailed: { type: Boolean, default: false },
			},
			emits: ['adjust-list', 'retry'],
			template: '<div />',
		}),
		ListAutomationsAdjust: defineVueComponent({
			name: 'ListAutomationsAdjust',
			template: '<div />',
		}),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	mocks.loadFailed = ref<boolean>(false);

	return {
		useAutomationSpaces: () => ({ fetchSpaces: mocks.fetchSpaces }),
		useAutomationsActions: () => ({ updating: ref([]), remove: vi.fn(), setEnabled: vi.fn() }),
		useAutomationsDataSource: () => ({
			fetchAutomations: mocks.fetchAutomations,
			automations: ref([]),
			automationsPaginated: ref([]),
			totalRows: ref(0),
			filters: ref({ search: undefined, spaceId: undefined, enabled: 'all', statuses: [] }),
			filtersActive: ref(false),
			sortBy: ref('name'),
			sortDir: ref('asc'),
			paginateSize: ref(10),
			paginatePage: ref(1),
			areLoading: ref(false),
			loadFailed: mocks.loadFailed,
			resetFilter: vi.fn(),
		}),
	};
});

describe('ViewAutomations', (): void => {
	let wrapper: VueWrapper;

	const mountView = async (): Promise<VueWrapper> => {
		wrapper = mount(ViewAutomations, {
			global: {
				stubs: {
					// The real drawer renders into the body; all that matters here is whether it is there and open
					ElDrawer: {
						name: 'ElDrawer',
						props: { modelValue: { type: Boolean, default: false } },
						template: '<div v-if="modelValue"><slot /></div>',
					},
					RouterView: true,
				},
			},
		});

		await flushPromises();

		return wrapper;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	beforeEach((): void => {
		vi.clearAllMocks();

		mocks.fetchAutomations.mockResolvedValue(undefined);
		mocks.fetchSpaces.mockResolvedValue(undefined);
		mocks.loadFailed.value = false;
		mocks.isLGDevice.value = true;
	});

	it.each([
		['on a large screen', true],
		['below the large breakpoint', false],
	])('opens the list adjustment %s', async (_, isLGDevice): Promise<void> => {
		mocks.isLGDevice.value = isLGDevice;

		await mountView();

		expect(wrapper.findComponent(ListAutomationsAdjust).exists()).toBe(false);

		wrapper.findComponent(ListAutomations).vm.$emit('adjust-list');

		await flushPromises();

		expect(wrapper.findComponent(ListAutomationsAdjust).exists()).toBe(true);
	});

	it('hands a failed first load to the list and loads again when asked to', async (): Promise<void> => {
		mocks.fetchAutomations.mockImplementationOnce(async (): Promise<never> => {
			mocks.loadFailed.value = true;

			throw new Error('offline');
		});

		// A rejection nobody handles would fail the test run
		await mountView();

		expect(wrapper.findComponent(ListAutomations).props('loadFailed')).toBe(true);
		expect(mocks.fetchAutomations).toHaveBeenCalledTimes(1);

		wrapper.findComponent(ListAutomations).vm.$emit('retry');

		await flushPromises();

		expect(mocks.fetchAutomations).toHaveBeenCalledTimes(2);
	});

	it('shows the list even when the spaces could not be loaded', async (): Promise<void> => {
		mocks.fetchSpaces.mockRejectedValue(new Error('offline'));

		await mountView();

		expect(wrapper.findComponent(ListAutomations).exists()).toBe(true);
	});
});
