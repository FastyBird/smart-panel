import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { injectAccountManager } from '../services/account-manager';

import enUS from './../../locales/en-US.json';
import type { AppNavigationProps } from './app-navigation.types';
import AppNavigation from './app-navigation.vue';

vi.mock('../composables/useMenu', async () => {
	const actual = await vi.importActual('../composables/useMenu');

	return {
		...actual,
		useMenu: vi.fn(() => ({
			mainMenuItems: {
				overview: { name: 'overview', meta: { title: 'Overview', icon: 'mdi:monitor-dashboard' }, children: {} },
				devices: { name: 'devices', meta: { title: 'Devices', icon: 'mdi:devices', menuGroup: 'home' }, children: {} },
				flagged: {
					name: 'flagged',
					meta: { title: 'Flagged', icon: 'mdi:flag', menuGroup: 'integrations', module: 'mcp-module', moduleFlag: 'oauthEnabled' },
					children: {},
				},
				settings: {
					name: 'settings',
					meta: { title: () => 'Configuration', icon: 'mdi:cog', menuGroup: 'system' },
					children: {
						modules: { name: 'modules', meta: { title: 'Modules', icon: 'mdi:package-variant' }, children: {} },
						plugins: { name: 'plugins', meta: { title: 'Plugins', icon: 'mdi:toy-brick' }, children: {} },
					},
				},
			},
		})),
	};
});

vi.mock('../../modules/config/composables/useConfigModules', () => ({
	useConfigModules: vi.fn(() => ({
		configModules: { value: [{ type: 'mcp-module', enabled: true, oauthEnabled: false }] },
		areLoading: { value: false },
		loaded: { value: true },
		enabled: () => true,
		fetchConfigModules: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock('../services/account-manager', () => ({
	injectAccountManager: vi.fn().mockReturnValue({
		signOut: vi.fn(),
		routes: { signIn: 'sign-in', signUp: 'sign-up' },
	}),
}));

const render = async (props: AppNavigationProps = {}, path = '/devices') => {
	const router = createRouter({
		history: createWebHistory(),
		routes: [
			{ path: '/', name: 'overview', component: {} },
			{ path: '/devices', name: 'devices', component: {} },
			{ path: '/sign-in', name: 'sign-in', component: {} },
			{
				path: '/settings',
				name: 'settings',
				component: { template: '<router-view />' },
				children: [
					{ path: 'modules', name: 'modules', component: {} },
					{ path: 'plugins', name: 'plugins', component: {} },
				],
			},
		],
	});

	router.push(path);
	await router.isReady();

	const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enUS } });

	const wrapper = mount(AppNavigation, { props, global: { plugins: [router, i18n] } });

	await flushPromises();

	return { wrapper, router };
};

const item = (wrapper: Awaited<ReturnType<typeof render>>['wrapper'], name: string) => wrapper.find(`[data-test-id="navigation-item-${name}"]`);

describe('AppNavigation', () => {
	it('renders the sidebar sections in order, with ungrouped items first', async () => {
		const { wrapper } = await render();

		expect(wrapper.findAll('[data-test-id="navigation-section"]').map((node) => node.text())).toEqual(['Home', 'System']);

		const order = wrapper.findAll('a').map((node) => node.text());

		expect(order).toEqual(['Overview', 'Devices', 'Configuration', 'Modules', 'Plugins']);
	});

	it('hides a menu item whose module flag is off, and its empty section', async () => {
		const { wrapper } = await render();

		expect(wrapper.text()).not.toContain('Flagged');
		expect(wrapper.text()).not.toContain('Integrations');
	});

	it('lists menu children indented below their parent', async () => {
		const { wrapper } = await render();

		expect(item(wrapper, 'modules').classes()).toContain('is-nested');
		expect(item(wrapper, 'settings').classes()).not.toContain('is-nested');
	});

	it('marks the current page', async () => {
		const { wrapper } = await render({}, '/devices');

		expect(item(wrapper, 'devices').attributes('aria-current')).toBe('page');
		expect(item(wrapper, 'devices').classes()).toContain('is-active');
		expect(item(wrapper, 'overview').attributes('aria-current')).toBeUndefined();
	});

	it('marks the matching child rather than its parent', async () => {
		const { wrapper } = await render({}, '/settings/plugins');

		expect(item(wrapper, 'plugins').attributes('aria-current')).toBe('page');
		expect(item(wrapper, 'settings').attributes('aria-current')).toBeUndefined();
	});

	it('shows icons only, named for assistive technology, in the rail', async () => {
		const { wrapper } = await render({ collapsed: true });

		expect(wrapper.find('[data-test-id="navigation-section"]').exists()).toBe(false);
		expect(wrapper.findAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
		expect(item(wrapper, 'devices').text()).toBe('');
		expect(item(wrapper, 'devices').attributes('aria-label')).toBe('Devices');
	});

	it('emits click when an item is chosen', async () => {
		const { wrapper } = await render();

		await item(wrapper, 'devices').trigger('click');

		expect(wrapper.emitted('click')).toBeTruthy();
	});

	it('shows the account actions only when asked, and signs out', async () => {
		const { wrapper } = await render();

		expect(wrapper.find('[data-test-id="navigation-sign-out"]').exists()).toBe(false);

		const phone = (await render({ accountActions: true })).wrapper;

		await phone.find('[data-test-id="navigation-sign-out"]').trigger('click');

		expect(injectAccountManager()?.signOut).toHaveBeenCalled();
	});
});
