import { computed } from 'vue';
import { type Router, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { RouteNames } from '../config.constants';

import LayoutConfig from './layout-config.vue';

enableAutoUnmount(afterEach);

const { fetchConfigPlugins, enabledTypes, loaded, confirmDiscard } = vi.hoisted(() => ({
	fetchConfigPlugins: vi.fn(),
	enabledTypes: new Set<string>(),
	loaded: { value: true },
	confirmDiscard: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('../../../common', async () => {
	const { computed } = await import('vue');
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		AppBreadcrumbs: { template: '<div data-test-id="app-breadcrumbs"></div>' },
		ViewHeader: { props: ['title'], template: '<h1 data-test-id="view-header">{{ title }}</h1>' },
		// The drawer is the edit drawer layout's job; here it only shows whether the form is open
		EditDrawerLayout: {
			props: ['open'],
			template: '<div><slot /><div v-if="open" data-test-id="drawer"><slot name="form" /></div></div>',
		},
		ViewError: { template: '<div><slot /></div>' },
		// From tablet portrait up the settings open in the drawer beside the page
		provideEditDrawer: () => ({ inDrawer: computed(() => true) }),
	};
});

vi.mock('../composables/useModules', () => ({
	useModules: () => ({
		modules: computed(() => [{ type: 'system-module', name: 'System', description: 'Monitor system health' }]),
	}),
}));

vi.mock('../composables/usePlugins', () => ({
	usePlugins: () => ({
		plugins: computed(() => [
			{ type: 'devices-shelly-ng', name: 'Shelly NG', description: 'Shelly Gen 2+ devices' },
			{ type: 'notifications-slack', name: 'Slack', description: 'Slack channel' },
			{ type: 'weather-open-meteo', name: 'Open-Meteo', description: 'Free weather' },
		]),
	}),
}));

vi.mock('../composables/useConfigPlugins', () => ({
	useConfigPlugins: () => ({
		enabled: (type: string) => enabledTypes.has(type),
		loaded: computed(() => loaded.value),
		fetchConfigPlugins,
	}),
}));

vi.mock('../composables/useConfigDiscard', () => ({
	useConfigDiscard: () => ({ confirmDiscard }),
}));

const EditForm = {
	name: 'EditForm',
	emits: ['update:remoteFormChanged'],
	template: '<div data-test-id="edit-form" />',
};

const render = async (location: Parameters<Router['push']>[0]): Promise<{ wrapper: VueWrapper; router: Router }> => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{
				path: '/config',
				name: RouteNames.CONFIG,
				component: LayoutConfig,
				children: [
					{ path: 'modules', name: RouteNames.CONFIG_MODULES, component: { render: () => null } },
					{ path: 'modules/:module', name: RouteNames.CONFIG_MODULE_EDIT, component: EditForm },
					{ path: 'plugins', name: RouteNames.CONFIG_PLUGINS, component: { render: () => null } },
					{ path: 'plugins/:plugin', name: RouteNames.CONFIG_PLUGIN_EDIT, component: EditForm },
				],
			},
		],
	});

	await router.push(location);

	const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs: { Icon: true } } });

	await flushPromises();

	return { wrapper, router };
};

describe('LayoutConfig.vue', (): void => {
	beforeEach((): void => {
		vi.clearAllMocks();
		fetchConfigPlugins.mockResolvedValue(undefined);
		enabledTypes.clear();
		enabledTypes.add('devices-shelly-ng');
		loaded.value = true;
		confirmDiscard.mockResolvedValue(true);
	});

	it('lists the modules, then the plugins by family, each in a section of its own', async (): Promise<void> => {
		const { wrapper } = await render({ name: RouteNames.CONFIG_MODULES });

		expect(wrapper.findAll('[data-test-id="settings-section"]').map((section) => section.attributes('id'))).toEqual([
			'modules',
			'plugins-devices',
			'plugins-notifications',
			'plugins-weather',
		]);
		expect(fetchConfigPlugins).toHaveBeenCalledTimes(1);
	});

	it('tells which plugins are enabled', async (): Promise<void> => {
		const { wrapper } = await render({ name: RouteNames.CONFIG_PLUGINS });

		const tag = (type: string) => wrapper.find(`[data-item-id="${type}"] [data-test-id="status-tag"]`).text();

		expect(tag('devices-shelly-ng')).toContain('configModule.states.enabled');
		expect(tag('notifications-slack')).toContain('configModule.states.disabled');
	});

	it('shows no state before the settings are read', async (): Promise<void> => {
		loaded.value = false;

		const { wrapper } = await render({ name: RouteNames.CONFIG_PLUGINS });

		expect(wrapper.find('[data-item-id="devices-shelly-ng"] [data-test-id="status-tag"]').exists()).toBe(false);
	});

	it('opens a plugin row in the drawer and marks it', async (): Promise<void> => {
		const { wrapper, router } = await render({ name: RouteNames.CONFIG_PLUGINS });

		await wrapper.find('[data-item-id="notifications-slack"]').trigger('click');
		await flushPromises();

		expect(router.currentRoute.value).toMatchObject({ name: RouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: 'notifications-slack' } });
		expect(wrapper.find('[data-test-id="drawer"] [data-test-id="edit-form"]').exists()).toBe(true);
		expect(wrapper.find('[data-item-id="notifications-slack"]').attributes('aria-current')).toBe('true');
	});

	it('asks before another row replaces a changed form, and stays when the changes are kept', async (): Promise<void> => {
		const { wrapper, router } = await render({ name: RouteNames.CONFIG_MODULE_EDIT, params: { module: 'system-module' } });

		wrapper.findComponent(EditForm).vm.$emit('update:remoteFormChanged', true);
		confirmDiscard.mockResolvedValue(false);

		await wrapper.find('[data-item-id="notifications-slack"]').trigger('click');
		await flushPromises();

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(router.currentRoute.value.name).toBe(RouteNames.CONFIG_MODULE_EDIT);
	});

	it('says when the settings could not be read, and reads them again', async (): Promise<void> => {
		fetchConfigPlugins.mockRejectedValueOnce(new Error('offline'));

		const { wrapper } = await render({ name: RouteNames.CONFIG_MODULES });

		const banner = wrapper.find('[data-test-id="config-load-error"]');

		expect(banner.exists()).toBe(true);

		await banner.find('button').trigger('click');
		await flushPromises();

		expect(fetchConfigPlugins).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="config-load-error"]').exists()).toBe(false);
	});
});
