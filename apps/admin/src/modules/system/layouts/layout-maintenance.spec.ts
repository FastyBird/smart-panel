import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { StandaloneLayout } from '../../../common';
import { RouteNames } from '../system.constants';

import LayoutMaintenance from './layout-maintenance.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const render = async (name: string) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [RouteNames.POWER_OFF, RouteNames.FACTORY_RESET, RouteNames.REBOOTING, RouteNames.SERVICE_RESTARTING].map((routeName) => ({
			path: `/${routeName}`,
			name: routeName,
			component: { template: '<div />' },
		})),
	});

	await router.push({ name });

	const wrapper = mount(LayoutMaintenance, { global: { plugins: [router] } });

	await flushPromises();

	return wrapper.findComponent(StandaloneLayout);
};

describe('LayoutMaintenance', (): void => {
	it.each([
		[RouteNames.REBOOTING, 'systemModule.maintenance.rebooting.title'],
		[RouteNames.SERVICE_RESTARTING, 'systemModule.maintenance.serviceRestarting.title'],
		[RouteNames.FACTORY_RESET, 'systemModule.maintenance.factoryReset.title'],
	])('titles %s and says the page carries on by itself', async (name, title): Promise<void> => {
		const layout = await render(name);

		expect(layout.find('h1').text()).toBe(title);
		expect(layout.props('subtitle')).toBe('systemModule.maintenance.waitingSubtitle');
	});

	it('titles the powered-off screen, with nothing left to wait for', async (): Promise<void> => {
		const layout = await render(RouteNames.POWER_OFF);

		expect(layout.find('h1').text()).toBe('systemModule.maintenance.poweredOff.title');
		expect(layout.props('subtitle')).toBeUndefined();
	});

	it('keeps the project links and the copyright', async (): Promise<void> => {
		const layout = await render(RouteNames.REBOOTING);

		expect(layout.findAll('[data-test-id="standalone-layout-links"] nav a')).toHaveLength(4);
		expect(layout.find('[data-test-id="author-link"]').exists()).toBe(true);
	});
});
