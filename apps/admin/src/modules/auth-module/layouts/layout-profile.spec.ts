import { type ComponentPublicInstance, computed } from 'vue';
import { createI18n } from 'vue-i18n';
import { type Router, createMemoryHistory, createRouter } from 'vue-router';

import { ElButton, ElTabPane, ElTabs } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { RouteNames } from '../auth.constants';
import enUS from '../locales/en-US.json';

import LayoutProfile from './layout-profile.vue';

type LayoutProfileInstance = ComponentPublicInstance<{ activeTab: string; remoteFormSubmit: boolean }>;

vi.mock('../../../common', () => ({
	AppBarHeading: { template: '<div data-test-id="app-bar-heading"></div>' },
	AppBreadcrumbs: { template: '<div data-test-id="app-breadcrumbs"></div>' },
	ViewHeader: { template: '<div data-test-id="view-header"><slot name="extra" /></div>' },
	UserAvatar: { template: '<div data-test-id="user-avatar"></div>' },
	injectStoresManager: vi.fn(() => ({
		getStore: vi.fn(() => ({
			profile: { email: 'test@example.com', username: 'testuser' },
		})),
	})),
	useBreakpoints: vi.fn(() => ({
		isMDDevice: computed<boolean>(() => true),
	})),
}));

describe('LayoutProfile.vue', (): void => {
	let wrapper: VueWrapper<LayoutProfileInstance>;
	let router: Router;

	beforeEach(async (): Promise<void> => {
		vi.clearAllMocks();

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					authModule: enUS,
				},
			},
		});

		router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', name: AppRouteNames.ROOT, component: { template: '<div>Home</div>' } },
				{
					path: '/profile',
					name: 'profile',
					component: { template: '<div><div id="breadcrumbs-target"></div> <router-view /></div>' },
					children: [
						{ path: '/profile/general', name: RouteNames.PROFILE_GENERAL, component: { template: '<div>General</div>' } },
						{ path: '/profile/security', name: RouteNames.PROFILE_SECURITY, component: { template: '<div>Security</div>' } },
					],
				},
			],
		});

		router.push({ name: RouteNames.PROFILE_GENERAL });

		wrapper = mount(LayoutProfile, {
			global: {
				plugins: [i18n, router],
			},
		}) as VueWrapper<LayoutProfileInstance>;

		await router.isReady();
	});

	it('renders correctly', async (): Promise<void> => {
		expect(wrapper.findComponent(ElTabs).exists()).toBe(true);

		expect(wrapper.findComponent(ElButton).exists()).toBe(true);
	});

	it('displays correct tab and updates on route change', async (): Promise<void> => {
		expect(wrapper.findComponent(ElTabs).exists()).toBe(true);
		expect(wrapper.findComponent(ElTabPane).exists()).toBe(true);

		await router.push({ name: RouteNames.PROFILE_SECURITY });

		expect(wrapper.vm.activeTab).toBe('security');
	});

	it('calls onSave when save button is clicked', async (): Promise<void> => {
		expect(wrapper.find('[data-test-id="view-header"]').findComponent(ElButton).exists()).toBe(true);

		await wrapper.find('[data-test-id="view-header"]').findComponent(ElButton).trigger('click');

		expect(wrapper.vm.remoteFormSubmit).toBe(true);
	});
});
