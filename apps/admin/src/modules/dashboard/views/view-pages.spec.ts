/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../dashboard.constants';

import ViewPages from './view-pages.vue';

const confirm = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: vi.fn(),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button><slot /></button>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<div />' },
	ViewHeader: { name: 'ViewHeader', props: ['actions'], template: '<div><slot name="actions" /></div>' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	EditDrawerLayout: { name: 'EditDrawerLayout', template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => true) }),
}));

vi.mock('../../displays', () => ({
	useDisplays: () => ({ fetchDisplays: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../composables/composables', () => ({
	usePagesActions: () => ({ remove: vi.fn(), bulkRemove: vi.fn() }),
	usePagesDataSource: () => ({
		fetchPages: vi.fn().mockResolvedValue(undefined),
		pages: ref([]),
		pagesPaginated: ref([]),
		totalRows: ref(0),
		filters: ref({}),
		filtersActive: ref(false),
		sortBy: ref(undefined),
		sortDir: ref(null),
		paginateSize: ref(10),
		paginatePage: ref(1),
		areLoading: ref(false),
		resetFilter: vi.fn(),
	}),
}));

vi.mock('../components/components', () => ({
	ListPages: { name: 'ListPages', emits: ['edit', 'detail', 'configure'], template: '<div />' },
}));

// The routed form: records the dirty state it was mounted with, so a test can tell what the host handed it
const mountedWith: boolean[] = [];

const RoutedForm = defineComponent({
	name: 'RoutedForm',
	props: { remoteFormChanged: { type: Boolean, default: false } },
	emits: ['update:remote-form-changed'],
	setup(props) {
		mountedWith.push(props.remoteFormChanged);

		return (): ReturnType<typeof h> => h('form');
	},
});

const makeRouter = (): Router =>
	createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/pages',
				name: RouteNames.PAGES,
				component: ViewPages,
				children: [
					{ path: 'add', name: RouteNames.PAGES_ADD, component: RoutedForm },
					{ path: ':id', name: RouteNames.PAGES_EDIT, component: RoutedForm },
				],
			},
			{ path: '/page/:id', name: RouteNames.PAGE, component: { template: '<div />' } },
			{ path: '/page/:id/plugin', name: RouteNames.PAGE_PLUGIN, component: { template: '<div />' } },
		],
	});

const mountAt = async (path: string) => {
	const router = makeRouter();

	await router.push(path);

	const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } });

	await flushPromises();

	return { wrapper, router };
};

enableAutoUnmount(afterEach);

describe('ViewPages', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
	});

	it('opens the next page clean after a changed form is discarded', async () => {
		const { wrapper, router } = await mountAt('/pages/page-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'ListPages' }).vm.$emit('edit', 'page-b');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('page-b');
		expect(mountedWith).toEqual([false, false]);

		// The fresh form is not dirty, so opening another page does not ask again
		wrapper.findComponent({ name: 'ListPages' }).vm.$emit('edit', 'page-c');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('page-c');
	});

	it('keeps the changed form when leaving for a detail page is declined', async () => {
		const { wrapper, router } = await mountAt('/pages/page-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'ListPages' }).vm.$emit('detail', 'page-b');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGES_EDIT);
		expect(router.currentRoute.value.params.id).toBe('page-a');
	});

	it('asks before Configure leaves a changed form', async () => {
		const { wrapper, router } = await mountAt('/pages/page-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'ListPages' }).vm.$emit('configure', '/page/page-b/plugin');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGES_EDIT);

		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'ListPages' }).vm.$emit('configure', '/page/page-b/plugin');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_PLUGIN);
	});

	it('opens Add clean after the editor left for the list on its own', async () => {
		const { wrapper, router } = await mountAt('/pages/page-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);

		await router.replace({ name: RouteNames.PAGES });
		await flushPromises();

		await router.replace({ name: RouteNames.PAGES_ADD });
		await flushPromises();

		expect(mountedWith).toEqual([false, false]);
	});
});
