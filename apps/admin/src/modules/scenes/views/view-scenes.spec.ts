/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../scenes.constants';

import ViewScenes from './view-scenes.vue';

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
	ViewHeader: { name: 'ViewHeader', template: '<div />' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	EditDrawerLayout: { name: 'EditDrawerLayout', template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => true) }),
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../spaces/composables', () => ({
	useSpaces: () => ({ spaces: ref([]), fetchSpaces: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../composables/composables', () => ({
	useScenes: () => ({ triggerScene: vi.fn(), removeScene: vi.fn() }),
	useScenesActions: () => ({ bulkRemove: vi.fn(), bulkEnable: vi.fn(), bulkDisable: vi.fn() }),
	useScenesDataSource: () => ({
		fetchScenes: vi.fn().mockResolvedValue(undefined),
		scenes: ref([]),
		scenesPaginated: ref([]),
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
	ListScenes: { name: 'ListScenes', emits: ['edit'], template: '<div />' },
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
				path: '/scenes',
				name: RouteNames.SCENES,
				component: ViewScenes,
				children: [
					{ path: 'add', name: RouteNames.SCENES_ADD, component: RoutedForm },
					{ path: ':id', name: RouteNames.SCENES_EDIT, component: RoutedForm },
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

describe('ViewScenes', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
	});

	it('opens the next scene clean after a changed form is discarded', async () => {
		const { wrapper, router } = await mountAt('/scenes/scene-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'ListScenes' }).vm.$emit('edit', 'scene-b');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('scene-b');
		expect(mountedWith).toEqual([false, false]);

		// The fresh form is not dirty, so opening another scene does not ask again
		wrapper.findComponent({ name: 'ListScenes' }).vm.$emit('edit', 'scene-c');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.params.id).toBe('scene-c');
	});

	it('keeps the changed form when the discard is declined', async () => {
		const { wrapper, router } = await mountAt('/scenes/scene-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'ListScenes' }).vm.$emit('edit', 'scene-b');
		await flushPromises();

		expect(router.currentRoute.value.params.id).toBe('scene-a');

		// Still changed: the next attempt asks again
		wrapper.findComponent({ name: 'ListScenes' }).vm.$emit('edit', 'scene-b');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
	});

	it('opens Add clean after the editor left for the list on its own', async () => {
		const { wrapper, router } = await mountAt('/scenes/scene-a');

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);

		// The editor's own Close or Discard navigates back to the list
		await router.replace({ name: RouteNames.SCENES });
		await flushPromises();

		await router.replace({ name: RouteNames.SCENES_ADD });
		await flushPromises();

		expect(mountedWith).toEqual([false, false]);
	});
});
