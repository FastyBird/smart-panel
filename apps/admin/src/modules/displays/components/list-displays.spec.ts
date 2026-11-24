import { nextTick, reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import ListDisplays from './list-displays.vue';

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
	useSizeClass: () => ({ isPhone: ref(false) }),
}));

vi.mock('./list-displays-adjust.vue', () => ({ default: { name: 'ListDisplaysAdjust', template: '<div />' } }));
vi.mock('./displays-table.vue', () => ({ default: { name: 'DisplaysTable', template: '<div />' } }));
vi.mock('./displays-row-list.vue', () => ({ default: { name: 'DisplaysRowList', template: '<div />' } }));

type Filters = { search?: string; darkMode: string; screenSaver: string; state: string; states: string[] };

const mountList = (filters: Filters) =>
	shallowMount(ListDisplays, {
		props: {
			items: [],
			allItems: [],
			totalRows: 0,
			filters: filters as never,
			filtersActive: false,
			paginateSize: 10,
			paginatePage: 1,
			sortBy: undefined,
			sortDir: null,
			loading: false,
		},
		global: { stubs: { ElCard: { template: '<div><slot /></div>' } } },
	});

describe('ListDisplays', () => {
	it('offers the online state as the quick filter and counts the drawer filters too', async () => {
		const filters = reactive<Filters>({ search: undefined, darkMode: 'enabled', screenSaver: 'all', state: 'all', states: ['lost'] });
		const wrapper = mountList(filters);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });

		expect((bar.props('quickFilters') as { id: string }[]).map((filter) => filter.id)).toEqual(['state']);
		expect(bar.props('activeCount')).toBe(2);

		bar.vm.$emit('quick-filter', 'state', 'offline');
		await nextTick();

		expect(filters.state).toBe('offline');
		expect(bar.props('activeCount')).toBe(3);

		bar.vm.$emit('quick-filter', 'state', null);

		expect(filters.state).toBe('all');
	});
});
