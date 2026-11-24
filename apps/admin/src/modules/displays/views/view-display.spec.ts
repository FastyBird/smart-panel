/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../displays.constants';

import ViewDisplay from './view-display.vue';

const confirm = vi.fn();

const ID = '00000000-0000-4000-8000-00000000d001';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('element-plus', () => ({
	ElButton: { name: 'ElButton', template: '<button v-bind="$attrs"><slot /></button>' },
	ElTooltip: { name: 'ElTooltip', template: '<div><slot /></div>' },
	ElTabs: { name: 'ElTabs', props: ['modelValue'], emits: ['tab-change'], template: '<div><slot /></div>' },
	ElTabPane: { name: 'ElTabPane', props: ['name'], template: '<section><slot /></section>' },
	ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) },
}));

vi.mock('@iconify/vue', () => ({
	Icon: { name: 'Icon', template: '<i />' },
}));

vi.mock('../../../common', () => ({
	AppBreadcrumbs: { name: 'AppBreadcrumbs', props: ['items'], template: '<div />' },
	ViewHeader: { name: 'ViewHeader', props: ['actions'], template: '<div><slot name="actions" /></div>' },
	ViewError: { name: 'ViewError', template: '<div><slot /></div>' },
	StateView: { name: 'StateView', template: '<div />' },
	EditDrawerLayout: { name: 'EditDrawerLayout', props: ['open'], template: '<div><slot /><slot name="form" /></div>' },
	provideEditDrawer: () => ({ inDrawer: computed<boolean>(() => true) }),
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

vi.mock('../../dashboard/composables/composables', () => ({
	usePages: () => ({ pages: ref([]), fetchPages: vi.fn(), loaded: ref(true) }),
}));

vi.mock('../../spaces/composables', () => ({
	useSpaces: () => ({ fetchSpaces: vi.fn(), firstLoadFinished: ref(true) }),
}));

vi.mock('../composables/composables', () => ({
	useDisplay: () => ({ display: ref({ id: ID, name: 'Kitchen', macAddress: 'aa:bb' }), isLoading: ref(false) }),
}));

vi.mock('../components/display-summary.vue', () => ({ default: { name: 'DisplaySummary', template: '<div />' } }));
vi.mock('../components/display-overview.vue', () => ({ default: { name: 'DisplayOverview', template: '<div />' } }));
vi.mock('../components/display-tokens.vue', () => ({ default: { name: 'DisplayTokens', template: '<div />' } }));

// The routed edit form: records the dirty state it was mounted with
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
			{ path: '/displays', name: RouteNames.DISPLAYS, component: { render: () => null } },
			{
				path: '/display/:id',
				name: RouteNames.DISPLAY,
				component: ViewDisplay,
				props: true,
				children: [
					{ path: 'edit', name: RouteNames.DISPLAY_EDIT, component: RoutedForm, props: true },
					{ path: 'tokens', name: RouteNames.DISPLAY_TOKENS, component: { render: () => null } },
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

describe('ViewDisplay', () => {
	beforeEach(() => {
		mountedWith.length = 0;
		confirm.mockReset();
	});

	it('opens Access tokens from its own link and keeps the route in step with the tab', async () => {
		const { wrapper, router } = await mountAt(`/display/${ID}/tokens`);
		const tabs = wrapper.findComponent({ name: 'ElTabs' });

		expect(tabs.props('modelValue')).toBe('tokens');

		tabs.vm.$emit('tab-change', 'overview');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAY);
		expect(tabs.props('modelValue')).toBe('overview');
	});

	it('opens edit in the drawer and returns to the tab it was opened from', async () => {
		const { wrapper, router } = await mountAt(`/display/${ID}/tokens`);

		await wrapper.find('[data-test-id="display-edit"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAY_EDIT);
		expect(wrapper.findComponent({ name: 'EditDrawerLayout' }).props('open')).toBe(true);
		expect(wrapper.findComponent({ name: 'ElTabs' }).props('modelValue')).toBe('tokens');

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAY_TOKENS);
	});

	it('asks before closing a changed form, and keeps it when the discard is declined', async () => {
		const { wrapper, router } = await mountAt(`/display/${ID}/edit`);

		wrapper.findComponent(RoutedForm).vm.$emit('update:remote-form-changed', true);
		confirm.mockRejectedValue('cancel');

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAY_EDIT);

		confirm.mockResolvedValue(true);

		wrapper.findComponent({ name: 'EditDrawerLayout' }).vm.$emit('close');
		await flushPromises();

		expect(router.currentRoute.value.name).toBe(RouteNames.DISPLAY);

		// The next edit form starts clean
		await wrapper.find('[data-test-id="display-edit"]').trigger('click');
		await flushPromises();

		expect(mountedWith).toEqual([false, false]);
	});
});
