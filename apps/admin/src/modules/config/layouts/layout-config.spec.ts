import { type ComponentPublicInstance, computed } from 'vue';
import { type Router, createMemoryHistory, createRouter } from 'vue-router';

import { ElButton, ElTabPane, ElTabs } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { RouteNames } from '../config.constants';

import LayoutConfig from './layout-config.vue';

type LayoutConfigInstance = ComponentPublicInstance<{ activeTab: string; remoteFormSubmit: boolean }>;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		AppBarHeading: { template: '<div data-test-id="app-bar-heading"></div>' },
		AppBreadcrumbs: { template: '<div data-test-id="app-breadcrumbs"></div>' },
		ViewHeader: { template: '<div data-test-id="view-header"><slot name="extra" /></div>' },
		UserAvatar: { template: '<div data-test-id="user-avatar"></div>' },
		useBreakpoints: vi.fn(() => ({
			isMDDevice: computed<boolean>(() => true),
		})),
	};
});

describe('LayoutConfig.vue', (): void => {
	let wrapper: VueWrapper<LayoutConfigInstance>;
	let router: Router;

	beforeEach(async (): Promise<void> => {
		vi.clearAllMocks();

		router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: '/', name: AppRouteNames.ROOT, component: { template: '<div>Home</div>' } },
				{
					path: '/config',
					name: RouteNames.CONFIG,
					component: { template: '<div><div id="breadcrumbs-target"></div> <router-view /></div>' },
					children: [
						{ path: 'audio', name: RouteNames.CONFIG_AUDIO, component: { template: '<div>Audio</div>' } },
						{ path: 'display', name: RouteNames.CONFIG_DISPLAY, component: { template: '<div>Display</div>' } },
						{ path: 'language', name: RouteNames.CONFIG_LANGUAGE, component: { template: '<div>Language</div>' } },
						{ path: 'weather', name: RouteNames.CONFIG_WEATHER, component: { template: '<div>Weather</div>' } },
					],
				},
			],
		});

		router.push({ name: RouteNames.CONFIG_AUDIO });

		wrapper = mount(LayoutConfig, {
			global: {
				plugins: [router],
			},
		}) as VueWrapper<LayoutConfigInstance>;

		await router.isReady();
	});

	it('renders correctly', async (): Promise<void> => {
		expect(wrapper.findComponent(ElTabs).exists()).toBe(true);

		expect(wrapper.findComponent(ElButton).exists()).toBe(true);
	});

	it('displays correct tab and updates on route change', async (): Promise<void> => {
		expect(wrapper.findComponent(ElTabs).exists()).toBe(true);
		expect(wrapper.findComponent(ElTabPane).exists()).toBe(true);

		await router.push({ name: RouteNames.CONFIG_DISPLAY });

		expect(wrapper.vm.activeTab).toBe('display');
	});

	it('calls onSave when save button is clicked', async (): Promise<void> => {
		expect(wrapper.find('[data-test-id="view-header"]').findComponent(ElButton).exists()).toBe(true);

		await wrapper.find('[data-test-id="view-header"]').findComponent(ElButton).trigger('click');

		expect(wrapper.vm.remoteFormSubmit).toBe(true);
	});
});
