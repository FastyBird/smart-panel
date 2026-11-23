import { nextTick, reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import ListScenes from './list-scenes.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', () => ({
	ListFilterBar: {
		name: 'ListFilterBar',
		props: ['search', 'searchPlaceholder', 'quickFilters', 'activeCount', 'selectedCount'],
		emits: ['quick-filter', 'reset', 'clear-selection', 'update:search'],
		template: '<div />',
	},
	useSizeClass: () => ({ isPhone: ref(false) }),
}));

vi.mock('./list-scenes-adjust.vue', () => ({ default: { name: 'ListScenesAdjust', template: '<div />' } }));
vi.mock('./scenes-table.vue', () => ({ default: { name: 'ScenesTable', template: '<div />' } }));
vi.mock('./scenes-row-list.vue', () => ({ default: { name: 'ScenesRowList', template: '<div />' } }));

type Filters = { search?: string; categories: string[]; primarySpaceId?: string; enabled: string };

const mountList = (filters: Filters) =>
	shallowMount(ListScenes, {
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
			triggering: [],
		},
		global: { stubs: { ElCard: { template: '<div><slot /></div>' } } },
	});

describe('ListScenes', () => {
	it('offers Enabled as the quick filter and counts the drawer filters too', async () => {
		const filters = reactive<Filters>({ search: undefined, categories: ['lighting'], primarySpaceId: undefined, enabled: 'all' });
		const wrapper = mountList(filters);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });

		expect((bar.props('quickFilters') as { id: string }[]).map((filter) => filter.id)).toEqual(['enabled']);
		expect(bar.props('activeCount')).toBe(1);

		bar.vm.$emit('quick-filter', 'enabled', 'disabled');
		await nextTick();

		expect(filters.enabled).toBe('disabled');
		expect(bar.props('activeCount')).toBe(2);

		bar.vm.$emit('quick-filter', 'enabled', null);

		expect(filters.enabled).toBe('all');
	});
});
