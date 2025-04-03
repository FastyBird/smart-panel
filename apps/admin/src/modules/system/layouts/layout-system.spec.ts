import { type ComponentPublicInstance, computed } from 'vue';
import { type Router, createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { RouteNames } from '../system.constants';

import LayoutSystem from './layout-system.vue';

type LayoutSystemInstance = ComponentPublicInstance<{ activeTab: string; remoteFormSubmit: boolean }>;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	AppBarHeading: { template: '<div data-test-id="app-bar-heading"></div>' },
	AppBreadcrumbs: { template: '<div data-test-id="app-breadcrumbs"></div>' },
	ViewHeader: { template: '<div data-test-id="view-header"><slot name="extra" /></div>' },
	UserAvatar: { template: '<div data-test-id="user-avatar"></div>' },
	useBreakpoints: vi.fn(() => ({
		isMDDevice: computed<boolean>(() => true),
	})),
}));

describe('LayoutSystem.vue', (): void => {
	let wrapper: VueWrapper<LayoutSystemInstance>;
	let router: Router;

	beforeEach(async (): Promise<void> => {
		vi.clearAllMocks();

		router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', name: AppRouteNames.ROOT, component: { template: '<div>Home</div>' } },
				{
					path: '/system',
					name: RouteNames.SYSTEM,
					component: { template: '<div><div id="breadcrumbs-target"></div> <router-view /></div>' },
					children: [{ path: 'info', name: RouteNames.SYSTEM_INFO, component: { template: '<div>System info</div>' } }],
				},
			],
		});

		router.push({ name: RouteNames.SYSTEM_INFO });

		wrapper = mount(LayoutSystem, {
			global: {
				plugins: [router],
			},
		}) as VueWrapper<LayoutSystemInstance>;

		await router.isReady();
	});

	it('renders correctly', async (): Promise<void> => {
		expect(wrapper.find('div').exists()).toBe(true);
	});
});
