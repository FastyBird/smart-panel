import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import StatTile from './stat-tile.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const render = (props: Record<string, unknown> = {}) =>
	mount(StatTile, {
		props: { icon: 'mdi:cpu-64-bit', label: 'CPU', value: '12 %', ...props },
		global: { stubs: { ElTooltip: { template: '<div><slot /></div>' } } },
	});

describe('StatTile', () => {
	it('shows the figure with its label and hint', () => {
		const wrapper = render({ hint: 'Temp 48 °C' });

		expect(wrapper.text()).toContain('CPU');
		expect(wrapper.get('[data-test-id="stat-tile-value"]').text()).toBe('12 %');
		expect(wrapper.text()).toContain('Temp 48 °C');
	});

	it('says when the figure was measured, and warns once it is stale', () => {
		expect(render().find('[data-test-id="stat-tile-updated"]').exists()).toBe(false);

		const fresh = render({ lastUpdated: new Date(), stale: false });

		expect(fresh.get('[data-test-id="stat-tile-updated"]').classes()).toContain('text-muted');

		const stale = render({ lastUpdated: new Date(0), stale: true });

		expect(stale.get('[data-test-id="stat-tile-updated"]').classes()).toContain('text-warning');
	});

	it('draws a usage bar only for a figure that has one, kept between 0 and 100', () => {
		expect(render().findComponent({ name: 'ElProgress' }).exists()).toBe(false);

		expect(render({ progress: 140 }).findComponent({ name: 'ElProgress' }).props('percentage')).toBe(100);
		expect(render({ progress: -5 }).findComponent({ name: 'ElProgress' }).props('percentage')).toBe(0);
	});

	it('shows a skeleton until its figure arrives, and a dash when none came', () => {
		const loading = render({ value: '', loading: true });

		expect(loading.findComponent({ name: 'ElSkeleton' }).exists()).toBe(true);
		expect(loading.find('[data-test-id="stat-tile-value"]').exists()).toBe(false);

		expect(render({ value: '', loading: false }).get('[data-test-id="stat-tile-value"]').text()).toBe('—');
	});
});
