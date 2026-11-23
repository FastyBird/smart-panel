import { nextTick, reactive } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import McpOAuthTab from './mcp-oauth-tab.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	ListFilterBar: {
		name: 'ListFilterBar',
		props: ['search', 'searchPlaceholder', 'quickFilters', 'activeCount'],
		emits: ['quick-filter', 'reset', 'update:search'],
		template: '<div />',
	},
}));

const mountTab = (filters: { search?: string; status: string }, statusOptions: { value: string; label: string }[]) =>
	shallowMount(McpOAuthTab, {
		props: { filters, statusOptions, testId: 'tab' },
		global: { stubs: { ElCard: { template: '<section><slot /></section>' } } },
	});

describe('McpOAuthTab', () => {
	it('offers the status as a quick filter and writes it back, All as all', async () => {
		const filters = reactive({ search: undefined, status: 'all' });
		const wrapper = mountTab(filters, [{ value: 'active', label: 'active.label' }]);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });

		expect((bar.props('quickFilters') as { options: { label: string }[] }[])[0].options).toEqual([{ value: 'active', label: 'active.label' }]);

		bar.vm.$emit('quick-filter', 'status', 'active');
		await nextTick();

		expect(filters.status).toBe('active');
		expect(bar.props('activeCount')).toBe(1);

		bar.vm.$emit('quick-filter', 'status', null);
		expect(filters.status).toBe('all');
	});

	it('filters on search alone for a tab without a status', () => {
		const wrapper = mountTab(reactive({ search: undefined, status: 'all' }), []);

		expect(wrapper.findComponent({ name: 'ListFilterBar' }).props('quickFilters')).toEqual([]);
	});

	it('turns a cleared search back into no search', async () => {
		const filters = reactive<{ search?: string; status: string }>({ search: 'codex', status: 'all' });
		const wrapper = mountTab(filters, []);

		wrapper.findComponent({ name: 'ListFilterBar' }).vm.$emit('update:search', '');
		await nextTick();

		expect(filters.search).toBeUndefined();
	});
});
