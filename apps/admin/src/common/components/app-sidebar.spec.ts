import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { RouteNames } from '../../app.constants';
import { RouteNames as AuthModuleRouteNames } from '../../modules/auth-module';

import enUS from './../../locales/en-US.json';
import AppNavigation from './app-navigation.vue';
import AppSidebar from './app-sidebar.vue';

vi.mock('../../assets/images/fb_bird.svg?component', () => ({
	default: {
		template: '<svg data-testid="logo-bird"></svg>',
	},
}));

vi.mock('../../assets/images/fb_smartpanel.svg?component', () => ({
	default: {
		template: '<svg data-testid="logo-fasty-bird"></svg>',
	},
}));

vi.mock('../services', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({})),
	})),
	injectRouterGuard: vi.fn(() => ({
		handle: vi.fn(() => ({})).mockReturnValue(true),
	})),
}));

describe('AppSidebar', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: RouteNames.ROOT, component: {} },
				{ path: '/sign-in', name: AuthModuleRouteNames.SIGN_IN, component: {} },
			],
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: enUS,
			},
		});

		wrapper = mount(AppSidebar, {
			global: {
				plugins: [router, i18n],
			},
			props: {
				menuCollapsed: false,
			},
		});
	});

	it('renders correctly', () => {
		expect(wrapper.exists()).toBe(true);
	});

	it('displays the full logo when menu is not collapsed', () => {
		expect(wrapper.find('[data-testid="logo-bird"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="logo-fasty-bird"]').exists()).toBe(true);
	});

	it('hides the full logo when menu is collapsed', async () => {
		await wrapper.setProps({ menuCollapsed: true });

		expect(wrapper.find('[data-testid="logo-bird"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="logo-fasty-bird"]').exists()).toBe(false);
	});

	it('contains a router-link to root', () => {
		const link = wrapper.find('a');

		expect(link.exists()).toBe(true);
		expect(link.attributes('href')).toBe('/');
	});

	it('renders AppNavigation component', () => {
		expect(wrapper.findComponent(AppNavigation).exists()).toBe(true);
	});
});
