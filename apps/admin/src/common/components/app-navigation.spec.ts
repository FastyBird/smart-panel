import { nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { ElMenuItem, ElSubMenu } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { RouteNames, sessionStoreKey } from '../../modules/auth';
import { injectStoresManager } from '../services';

import enUS from './../../locales/en-US.json';
import AppNavigation from './app-navigation.vue';

const isMDDevice = ref(true);

vi.mock('../composables', () => ({
	useBreakpoints: vi.fn(() => ({
		isMDDevice: isMDDevice,
	})),
	useMenu: vi.fn(() => ({
		mainMenuItems: [
			{
				name: 'root',
				meta: { title: 'Dashboard', icon: 'mdi:home' },
				children: [],
			},
			{
				name: 'settings',
				meta: { title: 'Settings', icon: 'mdi:cog' },
				children: [
					{ name: 'profile', meta: { title: 'Profile', icon: 'mdi:user' } },
					{ name: 'security', meta: { title: 'Security', icon: 'mdi:lock' } },
				],
			},
		],
	})),
}));

const mockClear = vi.fn();

vi.mock('../services', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			clear: mockClear,
		})),
	})),
}));

describe('AppNavigation', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: 'root', component: {} },
				{ path: '/sign-in', name: RouteNames.SIGN_IN, component: {} },
				{
					path: '/settings',
					name: 'settings',
					component: {},
					children: [
						{ path: 'profile', name: 'profile', component: {} },
						{ path: 'security', name: 'security', component: {} },
					],
				},
			],
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: enUS,
			},
		});

		isMDDevice.value = true;

		wrapper = mount(AppNavigation, {
			global: {
				plugins: [router, i18n],
			},
			props: {
				collapsed: false,
			},
		});
	});

	it('renders correctly', () => {
		expect(wrapper.exists()).toBe(true);
	});

	it('displays menu items', () => {
		const menuItems = wrapper.findAllComponents(ElMenuItem);
		expect(menuItems.length).toBeGreaterThan(0);
	});

	it('displays submenus when present', () => {
		const subMenus = wrapper.findAllComponents(ElSubMenu);
		expect(subMenus.length).toBeGreaterThan(0);
	});

	it('emits event when menu item is clicked', async () => {
		const menuItems = wrapper.findAllComponents(ElMenuItem);

		await menuItems[0].trigger('click');

		expect(wrapper.emitted('click')).toBeTruthy();
	});

	it('logs out when sign-out button is clicked', async () => {
		expect(wrapper.find('[data-test-id="3-1"]').exists()).toBe(false);

		isMDDevice.value = false;
		await wrapper.vm.$nextTick(); // Ensure reactivity update

		const signOutButton = wrapper.find('[data-test-id="navigation-sign-out"]');
		expect(signOutButton.exists()).toBe(true);

		await signOutButton.trigger('click');
		await nextTick();

		expect(injectStoresManager().getStore(sessionStoreKey).clear).toHaveBeenCalled();
	});
});
