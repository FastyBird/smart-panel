/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../dashboard.constants';

import ViewPage from './view-page.vue';

const confirm = vi.fn();
const remove = vi.fn();

const ID = '00000000-0000-4000-8000-00000000a001';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElTooltip: { name: 'ElTooltip', template: '<div><slot /></div>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<div />' },
	ViewHeader: { name: 'ViewHeader', props: ['actions'], template: '<div><slot name="actions" /></div>' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	StateView: { name: 'StateView', template: '<div />' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => true) }),
	useFlashMessage: () => ({ warning: vi.fn() }),
	useUuid: () => ({ validate: () => true }),
}));

vi.mock('../composables/usePage', () => ({
	usePage: () => ({ page: ref({ id: ID, title: 'Living room' }), fetchPage: vi.fn().mockResolvedValue(undefined), isLoading: ref(false) }),
}));

vi.mock('../composables/useDataSourcesDataSource', () => ({
	useDataSourcesDataSource: () => ({ dataSources: ref([]), areLoading: ref(false), fetchDataSources: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../composables/useDataSourcesActions', () => ({
	useDataSourcesActions: () => ({ remove }),
}));

vi.mock('../components/pages/page-summary.vue', () => ({ default: { name: 'PageSummary', template: '<div />' } }));
vi.mock('../components/data-sources/data-sources-card.vue', () => ({
	default: { name: 'DataSourcesCard', emits: ['add', 'edit', 'remove'], template: '<div />' },
}));

// The routed form: records the dirty state it was mounted with
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
			{ path: '/pages', name: RouteNames.PAGES, component: { render: () => null } },
			{
				path: '/page/:id',
				name: RouteNames.PAGE,
				component: ViewPage,
				props: true,
				children: [
					{ path: 'edit', name: RouteNames.PAGE_EDIT, component: RoutedForm },
					{ path: 'data-source/add', name: RouteNames.PAGE_ADD_DATA_SOURCE, component: RoutedForm },
					{ path: 'data-source/:dataSourceId', name: RouteNames.PAGE_EDIT_DATA_SOURCE, component: RoutedForm },
				],
			},
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

describe('ViewPage', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
		remove.mockReset();
	});

	it('opens the data source forms and edit in the drawer next to the detail', async () => {
		const { wrapper, router } = await mountAt(`/page/${ID}`);
		const card = wrapper.findComponent({ name: 'DataSourcesCard' });

		card.vm.$emit('add');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_ADD_DATA_SOURCE);
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(true);

		card.vm.$emit('edit', 'ds-1');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_EDIT_DATA_SOURCE);
		expect(router.currentRoute.value.params.dataSourceId).toBe('ds-1');

		await wrapper.find('[data-test-id="page-edit"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE_EDIT);

		card.vm.$emit('remove', 'ds-1');

		expect(remove).toHaveBeenCalledWith('ds-1');
	});

	it('opens the next data source clean after a changed form is discarded, and keeps it when declined', async () => {
		const { wrapper, router } = await mountAt(`/page/${ID}/data-source/ds-1`);
		const card = wrapper.findComponent({ name: 'DataSourcesCard' });

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		card.vm.$emit('edit', 'ds-2');
		await flushPromises();

		expect(router.currentRoute.value.params.dataSourceId).toBe('ds-1');

		confirm.mockResolvedValue(true);

		card.vm.$emit('edit', 'ds-2');
		await flushPromises();

		expect(router.currentRoute.value.params.dataSourceId).toBe('ds-2');
		expect(mountedWith).toEqual([false, false]);
	});

	it('asks before closing a changed form', async () => {
		const { wrapper, router } = await mountAt(`/page/${ID}/edit`);

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.PAGE);
	});
});
