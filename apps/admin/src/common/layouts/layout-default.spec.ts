import { computed, ref } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../../app.constants';
import type { SizeClass } from '../composables/types';

import LayoutDefault from './layout-default.vue';

const sizeClass = ref<SizeClass>('dt');

vi.mock('../composables/useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

vi.mock('../../assets/images/fb_row.svg?component', () => ({
	default: { template: '<svg data-test-id="logo"></svg>' },
}));

vi.mock('../components/components', () => ({
	// Renders the `button-right` slot for real so the phone menu button can be asserted on
	AppBar: { template: '<div data-test-id="app-bar"><slot name="button-right" /></div>' },
	AppSidebar: {
		props: ['menuCollapsed', 'accountActions'],
		emits: ['navigate'],
		template:
			'<div data-test-id="app-sidebar" :data-collapsed="String(!!menuCollapsed)" :data-account="String(!!accountActions)" @click="$emit(\'navigate\')"></div>',
	},
	AppTopBar: {
		props: ['menuCollapsed', 'menuButton'],
		emits: ['update:menuCollapsed', 'open-menu'],
		template:
			'<button data-test-id="app-top-bar" :data-menu-button="menuButton" @click="menuButton === \'collapse\' ? $emit(\'update:menuCollapsed\', !menuCollapsed) : $emit(\'open-menu\')"></button>',
	},
}));

// `layout-default.vue` imports the bell from its own file, not the module barrel
vi.mock('../../modules/notifications/components/notification-bell.vue', () => ({
	default: { name: 'NotificationBell', template: '<div data-test-id="notification-bell"></div>' },
}));

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const render = () => {
	const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', name: RouteNames.ROOT, component: {} }] });

	return mount(LayoutDefault, {
		global: {
			plugins: [router],
			stubs: {
				// The drawer body renders only while it is open
				ElDrawer: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
			},
		},
	});
};

const find = (wrapper: ReturnType<typeof render>, id: string) => wrapper.find(`[data-test-id="${id}"]`);

describe('LayoutDefault', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('shows the full sidebar on desktop and collapses it to the rail', async () => {
		const wrapper = render();

		expect(find(wrapper, 'layout-aside').exists()).toBe(true);
		expect(find(wrapper, 'app-sidebar').attributes('data-collapsed')).toBe('false');
		expect(find(wrapper, 'app-top-bar').attributes('data-menu-button')).toBe('collapse');

		await find(wrapper, 'app-top-bar').trigger('click');

		expect(find(wrapper, 'app-sidebar').attributes('data-collapsed')).toBe('true');
		expect(
			find(wrapper, 'layout-aside')
				.classes()
				.some((name) => name.endsWith('__aside--collapsed'))
		).toBe(true);
		expect(find(wrapper, 'layout-menu-drawer').exists()).toBe(false);
	});

	it('keeps the full sidebar on wide screens', () => {
		sizeClass.value = 'wd';

		const wrapper = render();

		expect(find(wrapper, 'app-sidebar').attributes('data-collapsed')).toBe('false');
	});

	it('shows the icon rail on tablet landscape; Expand menu opens the drawer', async () => {
		sizeClass.value = 'tl';

		const wrapper = render();

		expect(find(wrapper, 'layout-aside').exists()).toBe(true);
		expect(find(wrapper, 'app-sidebar').attributes('data-collapsed')).toBe('true');
		expect(find(wrapper, 'app-top-bar').attributes('data-menu-button')).toBe('expand');

		await find(wrapper, 'app-top-bar').trigger('click');

		expect(find(wrapper, 'layout-menu-drawer').exists()).toBe(true);
		expect(find(wrapper, 'layout-menu-drawer').find('[data-test-id="app-sidebar"]').attributes('data-collapsed')).toBe('false');
	});

	it('has no sidebar on tablet portrait; Open menu opens the drawer', async () => {
		sizeClass.value = 'tp';

		const wrapper = render();

		expect(find(wrapper, 'layout-aside').exists()).toBe(false);
		expect(find(wrapper, 'app-top-bar').attributes('data-menu-button')).toBe('open');

		await find(wrapper, 'app-top-bar').trigger('click');

		expect(find(wrapper, 'layout-menu-drawer').exists()).toBe(true);
	});

	it('uses the app bar and the menu drawer with account actions on phones', async () => {
		sizeClass.value = 'phone';

		const wrapper = render();

		expect(find(wrapper, 'app-bar').exists()).toBe(true);
		expect(find(wrapper, 'app-top-bar').exists()).toBe(false);
		expect(find(wrapper, 'layout-open-menu').attributes('aria-label')).toBe('application.buttons.openMenu.title');

		await find(wrapper, 'layout-open-menu').trigger('click');

		expect(find(wrapper, 'layout-menu-drawer').find('[data-test-id="app-sidebar"]').attributes('data-account')).toBe('true');
	});

	it('closes the drawer after navigating', async () => {
		sizeClass.value = 'tp';

		const wrapper = render();

		await find(wrapper, 'app-top-bar').trigger('click');
		await find(wrapper, 'layout-menu-drawer').find('[data-test-id="app-sidebar"]').trigger('click');

		expect(find(wrapper, 'layout-menu-drawer').exists()).toBe(false);
	});

	it('closes the drawer when the window grows to desktop', async () => {
		sizeClass.value = 'tl';

		const wrapper = render();

		await find(wrapper, 'app-top-bar').trigger('click');

		sizeClass.value = 'dt';
		await flushPromises();

		expect(find(wrapper, 'layout-menu-drawer').exists()).toBe(false);
	});
});
