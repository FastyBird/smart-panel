import { computed, nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElHeader, ElSwitch } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { mount } from '@vue/test-utils';

import { RouteNames } from '../../app.constants';
import { useDarkMode } from '../composables/useDarkMode';
import { injectAccountManager } from '../services/account-manager';

import enUS from './../../locales/en-US.json';
import AppTopBar from './app-top-bar.vue';

const mockIsDark = ref(false);
const toggleDarkMock = vi.fn(() => {
	mockIsDark.value = !mockIsDark.value; // Simulate Vue reactivity
});

vi.mock('../composables/useDarkMode', () => ({
	useDarkMode: vi.fn(() => ({
		isDark: mockIsDark,
		toggleDark: toggleDarkMock,
	})),
}));

vi.mock('../services/account-manager', () => ({
	injectAccountManager: vi.fn().mockReturnValue({
		details: computed(() => ({
			id: 'user-1',
			name: 'John Doe',
			email: 'john.doe@example.com',
			username: 'johndoe',
		})),
		signOut: vi.fn(),
		routes: {
			signIn: 'sign-in',
			signUp: 'sign-up',
		},
	}),
}));

describe('AppTopBar.vue', () => {
	let wrapper: ReturnType<typeof mount>;

	beforeEach(() => {
		const router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: RouteNames.ROOT, component: {} },
				{ path: '/sign-in', name: 'sign-in', component: {} },
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

		await dropdownItems[1]?.find('div').trigger('click');
		await nextTick();

		expect(injectAccountManager()?.signOut).toHaveBeenCalled();
	});
});
