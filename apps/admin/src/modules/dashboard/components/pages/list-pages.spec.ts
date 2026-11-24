import { computed, nextTick, reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import ListPages from './list-pages.vue';

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

vi.mock('../../composables/usePagesPlugins', () => ({
	usePagesPlugins: () => ({
		options: computed(() => [
			{ value: 'tiles', label: 'Tiles page', disabled: false },
			{ value: 'cards', label: 'Cards page', disabled: false },
		]),
	}),
}));

vi.mock('./list-pages-adjust.vue', () => ({ default: { name: 'ListPagesAdjust', template: '<div />' } }));
vi.mock('./pages-table.vue', () => ({ default: { name: 'PagesTable', template: '<div />' } }));
vi.mock('./pages-row-list.vue', () => ({ default: { name: 'PagesRowList', template: '<div />' } }));

type Filters = { search?: string; types: string[]; displays: string[] };

const mountList = (filters: Filters) =>
	shallowMount(ListPages, {
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

describe('ListPages', () => {
	it('offers the page type as the quick filter and counts the displays filter too', async () => {
		const filters = reactive<Filters>({ search: undefined, types: [], displays: ['d1'] });
		const wrapper = mountList(filters);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });
		const quick = (): { id: string; options: { value: string }[]; value: string | null }[] => bar.props('quickFilters');

		expect(quick().map((filter) => filter.id)).toEqual(['type']);
		expect(quick()[0]?.options.map((option) => option.value)).toEqual(['tiles', 'cards']);
		expect(bar.props('activeCount')).toBe(1);

		bar.vm.$emit('quick-filter', 'type', 'tiles');
		await nextTick();

		expect(filters.types).toEqual(['tiles']);
		expect(quick()[0]?.value).toBe('tiles');
		expect(bar.props('activeCount')).toBe(2);

		// Several types picked in the drawer read as All in the bar
		filters.types = ['tiles', 'cards'];
		await nextTick();

		expect(quick()[0]?.value).toBeNull();

		bar.vm.$emit('quick-filter', 'type', null);

		expect(filters.types).toEqual([]);
	});
});
