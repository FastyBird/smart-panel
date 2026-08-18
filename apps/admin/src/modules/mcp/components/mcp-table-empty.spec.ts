import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import McpTableEmpty from './mcp-table-empty.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	IconWithChild: {
		name: 'IconWithChild',
		template: '<div><slot name="primary" /><slot name="secondary" /></div>',
	},
}));

const mountEmpty = (props: Record<string, unknown>) =>
	mount(McpTableEmpty, {
		props: { icon: 'mdi:key-chain', loading: false, emptyLabel: 'nothing.here', ...props },
		global: {
			stubs: {
				ElResult: { name: 'ElResult', template: '<div><slot name="icon" /><slot name="title" /><slot name="extra" /></div>' },
				ElButton: { name: 'ElButton', template: '<button><slot name="icon" /><slot /></button>' },
				ElText: { name: 'ElText', template: '<span><slot /></span>' },
			},
		},
	});

describe('McpTableEmpty', () => {
	it('offers a retry when the load failed', () => {
		const wrapper = mountEmpty({ failed: true });

		// A failed load is not "nothing here" — without a retry the only way back
		// is a full page reload.
		expect(wrapper.find('[data-test-id="mcp-table-retry"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('mcpModule.messages.loadFailed');
	});

	it('emits a retry request', async () => {
		const wrapper = mountEmpty({ failed: true });

		await wrapper.find('[data-test-id="mcp-table-retry"]').trigger('click');

		expect(wrapper.emitted('retry')).toHaveLength(1);
	});

	it('offers to clear filters when they are hiding everything', () => {
		const wrapper = mountEmpty({ filtersActive: true });

		expect(wrapper.find('[data-test-id="mcp-table-reset-filters"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="mcp-table-retry"]').exists()).toBe(false);
	});

	it('shows the plain empty message when nothing is wrong', () => {
		const wrapper = mountEmpty({});

		expect(wrapper.text()).toContain('nothing.here');
		expect(wrapper.find('[data-test-id="mcp-table-retry"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="mcp-table-reset-filters"]').exists()).toBe(false);
	});

	it('prefers the failure state over the filter state', () => {
		// Filters may well be active when a request fails; reporting "no matches"
		// would send the user chasing a filter that is not the problem.
		const wrapper = mountEmpty({ failed: true, filtersActive: true });

		expect(wrapper.find('[data-test-id="mcp-table-retry"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="mcp-table-reset-filters"]').exists()).toBe(false);
	});

	it('shows neither affordance while loading', () => {
		const wrapper = mountEmpty({ loading: true, failed: true });

		expect(wrapper.find('[data-test-id="mcp-table-retry"]').exists()).toBe(false);
	});
});
