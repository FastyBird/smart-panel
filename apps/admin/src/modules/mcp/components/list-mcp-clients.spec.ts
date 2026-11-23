import { nextTick, reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import type { IMcpClient } from '../schemas/client.types';

import ListMcpClients from './list-mcp-clients.vue';

const isPhone = ref(false);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	ListFilterBar: {
		name: 'ListFilterBar',
		props: ['search', 'searchPlaceholder', 'quickFilters', 'activeCount', 'selectedCount'],
		emits: ['quick-filter', 'reset', 'clear-selection', 'update:search'],
		template: '<div />',
	},
	useSizeClass: () => ({ isPhone }),
}));

const client = { id: 'c1', name: 'Test agent', capabilities: [] } as unknown as IMcpClient;

const mountList = (filters = { search: undefined, status: 'all', enabled: 'all', capabilities: [] }) =>
	shallowMount(ListMcpClients, {
		props: {
			items: [client],
			filters: filters as never,
			totalRows: 1,
			sortBy: 'name',
			sortDir: 'asc',
			paginateSize: 10,
			paginatePage: 1,
			loading: false,
			filtersActive: false,
		},
		global: { stubs: { ElCard: { template: '<div><slot /></div>' } } },
	});

describe('ListMcpClients', () => {
	it('offers status and enabled as quick filters, so a disabled client can be found', () => {
		isPhone.value = false;
		const wrapper = mountList();
		const quickFilters = wrapper.findComponent({ name: 'ListFilterBar' }).props('quickFilters') as { id: string }[];

		expect(quickFilters.map((filter) => filter.id)).toEqual(['status', 'enabled']);
	});

	it('writes the enabled quick filter into the filters, and All back to all', async () => {
		isPhone.value = false;
		const filters = reactive({ search: undefined, status: 'all', enabled: 'all', capabilities: [] });
		const wrapper = mountList(filters);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });

		bar.vm.$emit('quick-filter', 'enabled', 'disabled');
		await nextTick();
		expect(filters.enabled).toBe('disabled');
		expect(bar.props('activeCount')).toBe(1);

		bar.vm.$emit('quick-filter', 'enabled', null);
		expect(filters.enabled).toBe('all');
	});

	it('drops the selection when the table gives way to the phone rows', async () => {
		isPhone.value = false;
		const wrapper = mountList();

		wrapper.findComponent({ name: 'McpClientsTable' }).vm.$emit('selected-changes', [client]);
		await nextTick();
		expect(wrapper.findComponent({ name: 'ListFilterBar' }).props('selectedCount')).toBe(1);

		isPhone.value = true;
		await nextTick();
		isPhone.value = false;
		await nextTick();

		expect(wrapper.findComponent({ name: 'ListFilterBar' }).props('selectedCount')).toBe(0);
		expect(wrapper.emitted('selected-changes')?.at(-1)).toEqual([[]]);
	});
});
