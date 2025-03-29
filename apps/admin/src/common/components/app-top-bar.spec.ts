import { nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElHeader, ElSwitch } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { mount } from '@vue/test-utils';

import { RouteNames, sessionStoreKey } from '../../modules/auth';
import { useDarkMode } from '../composables';
import { injectStoresManager } from '../services';

import enUS from './../../locales/en-US.json';
import AppTopBar from './app-top-bar.vue';

const mockIsDark = ref(false);
const toggleDarkMock = vi.fn(() => {
	mockIsDark.value = !mockIsDark.value; // Simulate Vue reactivity
});

vi.mock('../composables', () => ({
	useDarkMode: vi.fn(() => ({
		isDark: mockIsDark,
		toggleDark: toggleDarkMock,
	})),
}));

const mockClear = vi.fn();

vi.mock('../services', () => ({
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			profile: {
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@example.com',
				username: 'johndoe',
			},
			clear: mockClear,
		})),
	})),
}));

describe('AppTopBar.vue', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: 'root', component: {} },
				{ path: '/sign-in', name: RouteNames.SIGN_IN, component: {} },
			],
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: enUS,
			},
		});

		wrapper = mount(AppTopBar, {
			global: {
				plugins: [router, i18n],
				components: { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElHeader, ElSwitch, Icon },
			},
			props: {
				menuCollapsed: false,
			},
		});
	});

	it('renders the component properly', () => {
		expect(wrapper.exists()).toBe(true);
	});

	it('toggles menu when clicking menu button', async () => {
		await wrapper.find('button').trigger('click');
		expect(wrapper.emitted('update:menuCollapsed')).toBeTruthy();
	});

	it('displays the correct user name', () => {
		expect(wrapper.text()).toContain('John Doe');
	});

	it('switches theme when clicking switch', async () => {
		await wrapper.findComponent(ElSwitch).trigger('click');
		await nextTick();

		expect(useDarkMode().toggleDark).toHaveBeenCalled();
	});

	it('calls sign out method when clicking sign out', async () => {
		const dropdownItems = wrapper.findAllComponents(ElDropdownItem);

		await dropdownItems[1].find('div').trigger('click');
		await nextTick();

		expect(injectStoresManager().getStore(sessionStoreKey).clear).toHaveBeenCalled();
	});
});
