/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../displays.constants';

import ViewDisplays from './view-displays.vue';

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
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const permitJoinAvailable = ref(false);

vi.mock('../composables/composables', () => ({
	useDisplaysActions: () => ({ remove: vi.fn(), bulkRemove: vi.fn() }),
	usePermitJoin: () => ({
		isAvailable: permitJoinAvailable,
		isActive: ref(false),
		remainingTimeFormatted: ref(''),
		activating: ref(false),
		fetchStatus: vi.fn().mockResolvedValue(undefined),
		activate: vi.fn().mockResolvedValue(undefined),
		deactivate: vi.fn().mockResolvedValue(undefined),
	}),
	useDisplaysDataSource: () => ({
		fetchDisplays: vi.fn().mockResolvedValue(undefined),
		displays: ref([]),
		displaysPaginated: ref([]),
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
	ListDisplays: { name: 'ListDisplays', emits: ['edit', 'detail'], template: '<div />' },
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
				path: '/displays',
				name: RouteNames.DISPLAYS,
				component: ViewDisplays,
				children: [{ path: ':id', name: RouteNames.DISPLAYS_EDIT, component: RoutedForm }],
			},
			{ path: '/display/:id', name: RouteNames.DISPLAY, component: { template: '<div />' } },
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

describe('ViewDisplays', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
		permitJoinAvailable.value = false;
	});

	it('opens the next display clean after a changed form is discarded', async () => {
		const { wrapper, router } = await mountAt('/displays/display-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'ListDisplays' }).vm.$emit('edit', 'display-b');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('display-b');
		expect(mountedWith).toEqual([false, false]);

		// The fresh form is not dirty, so opening another display does not ask again
		wrapper.findComponent({ name: 'ListDisplays' }).vm.$emit('edit', 'display-c');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('display-c');
	});

	it('keeps the changed form when leaving for a detail page is declined', async () => {
		const { wrapper, router } = await mountAt('/displays/display-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'ListDisplays' }).vm.$emit('detail', 'display-b');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAYS_EDIT);
		expect(router.currentRoute.value.params.id).toBe('display-a');
	});

	it('offers Permit join on the phone app bar only while the server allows it', async () => {
		const { wrapper } = await mountAt('/displays');
		const header = wrapper.findComponent({ name: 'ViewHeader' });

		expect((header.props('actions') as { icon: string }[]).map((action) => action.icon)).toEqual(['mdi:magnify']);

		permitJoinAvailable.value = true;
		await flushPromises();

		expect((header.props('actions') as { icon: string }[]).map((action) => action.icon)).toEqual(['mdi:magnify', 'mdi:link-variant-plus']);
	});
});
