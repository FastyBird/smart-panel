import { type ComponentPublicInstance, type Ref, ref } from 'vue';
import { type Router, createRouter, createWebHistory } from 'vue-router';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames } from '../../app.constants';
import { useBreakpoints } from '../composables/composables';

import LayoutDefault from './layout-default.vue';

type LayoutDefaultInstance = ComponentPublicInstance<{ menuState: boolean; mainMenuCollapsed: boolean; onToggleMenu: () => void }>;

vi.mock('../assets/images/fb_row.svg?component', () => ({
	default: {
		template: '<svg data-test-id="logo"></svg>',
	},
}));

vi.mock('../components/components', () => ({
	// Renders the `button-right` slot for real so the mobile menu toggle button (and its
	// accessible name) can be asserted on - every other slot stays uninvoked, matching the
	// other AppBar stand-ins below that never render anything AppBar would put around it.
	AppBar: { template: '<div data-test-id="app-bar"><slot name="button-right" /></div>' },
	AppNavigation: { template: '<div data-test-id="app-navigation"></div>' },
	AppSidebar: { template: '<div data-test-id="app-sidebar"></div>' },
	AppTopBar: { template: '<div data-test-id="app-top-bar"></div>' },
}));
vi.mock('../composables/useBreakpoints', () => ({
	useBreakpoints: vi.fn(),
}));
// Mocks the direct file, not the module's `components/components` barrel: `layout-default.vue`
// imports `NotificationBell` straight from its own file (see the comment there), so mocking the
// barrel never intercepts it - matching the pattern in `app-top-bar.spec.ts`.
vi.mock('../../modules/notifications/components/notification-bell.vue', () => ({
	default: { name: 'NotificationBell', template: '<div data-test-id="notification-bell"></div>' },
}));
// Keeps the rest of the real module (`src/locales/index.ts` calls the real `createI18n` as a
// side effect of an unrelated barrel import below) and only swaps `useI18n` itself.
vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string) => key,
		}),
	};
});

describe('LayoutDefault', () => {
	let wrapper: VueWrapper<LayoutDefaultInstance>;
	let mockBreakpoints: Record<string, Ref<boolean>>;
	let mockRouter: Router;

	beforeEach(() => {
		vi.clearAllMocks();

		mockRouter = createRouter({
			history: createWebHistory(),
			routes: [{ path: '/', name: RouteNames.ROOT, component: {} }],
		});

		mockBreakpoints = {
			isMDDevice: ref(false),
			isXLDevice: ref(true),
		};
		(useBreakpoints as Mock).mockReturnValue(mockBreakpoints);

		wrapper = mount(LayoutDefault, {
			global: {
				plugins: [mockRouter],
			},
		}) as VueWrapper<LayoutDefaultInstance>;

		vi.spyOn(console, 'warn').mockImplementation((msg) => {
			if (msg.includes('Component is missing template or render function')) return;

			if (typeof msg !== 'undefined') {
				console.warn(msg);
			}
		});
	});

	it('renders correctly', () => {
		expect(wrapper.exists()).toBe(true);
	});

	it('displays AppBar component', () => {
		expect(wrapper.find('[data-test-id="app-bar"]').exists()).toBe(true);
	});

	it('renders AppSidebar when in non-mobile mode', async () => {
		mockBreakpoints.isMDDevice!.value = true;

		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-test-id="app-sidebar"]').exists()).toBe(true);
	});

	it('does not render AppSidebar in mobile mode', async () => {
		mockBreakpoints.isMDDevice!.value = false;

		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-test-id="app-sidebar"]').exists()).toBe(false);
	});

	it('toggles mobile menu when onToggleMenu is called', async () => {
		const menuStateBefore = wrapper.vm.menuState;

		wrapper.vm.onToggleMenu();

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.menuState).toBe(!menuStateBefore);
	});

	it('renders AppNavigation inside mobile drawer', async () => {
		mockBreakpoints.isMDDevice!.value = false;

		await wrapper.vm.$nextTick();

		wrapper.vm.onToggleMenu();

		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-test-id="app-navigation"]').exists()).toBe(true);
	});

	it('renders AppTopBar component in desktop mode', async () => {
		mockBreakpoints.isMDDevice!.value = true;

		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-test-id="app-top-bar"]').exists()).toBe(true);
	});

	it('does not render AppTopBar component in mobile mode', async () => {
		mockBreakpoints.isMDDevice!.value = false;

		await wrapper.vm.$nextTick();

		expect(wrapper.find('[data-test-id="app-top-bar"]').exists()).toBe(false);
	});

	it('updates mainMenuCollapsed state when isXLDevice changes', async () => {
		expect(wrapper.vm.mainMenuCollapsed).toBe(false);

		mockBreakpoints.isXLDevice!.value = false;

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.mainMenuCollapsed).toBe(true);
	});

	it('gives the mobile menu toggle button an accessible name', () => {
		const menuButton = wrapper.find('[data-test-id="app-bar"] button');

		expect(menuButton.exists()).toBe(true);
		expect(menuButton.attributes('aria-label')).toBe('application.buttons.toggleMenu.title');
	});
});
