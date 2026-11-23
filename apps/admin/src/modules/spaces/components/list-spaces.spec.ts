import { computed, nextTick, reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import ListSpaces from './list-spaces.vue';

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

vi.mock('../composables', () => ({
	useSpacesPlugins: () => ({
		options: computed(() => [
			{ value: 'room', label: 'Room', disabled: false },
			{ value: 'zone', label: 'Zone', disabled: false },
			{ value: 'master', label: 'Master', disabled: true },
		]),
	}),
}));

const mountList = (filters = reactive<{ search?: string; types: string[] }>({ search: undefined, types: [] })) =>
	shallowMount(ListSpaces, {
		props: { items: [], allItems: [], totalRows: 0, loading: false, filtersActive: false, filters, paginatePage: 1, paginateSize: 10 },
		global: { stubs: { ElCard: { template: '<div><slot /></div>' } } },
	});

describe('ListSpaces', () => {
	it('offers the enabled space types as a quick filter, and writes one back', async () => {
		const filters = reactive<{ search?: string; types: string[] }>({ search: undefined, types: [] });
		const wrapper = mountList(filters);
		const bar = wrapper.findComponent({ name: 'ListFilterBar' });

		expect((bar.props('quickFilters') as { options: { value: string }[] }[])[0].options.map((option) => option.value)).toEqual(['room', 'zone']);

		bar.vm.$emit('quick-filter', 'type', 'zone');
		await nextTick();

		expect(filters.types).toEqual(['zone']);
		expect(bar.props('activeCount')).toBe(1);

		bar.vm.$emit('quick-filter', 'type', null);

		expect(filters.types).toEqual([]);
	});

	it('turns a cleared search back into no search', async () => {
		const filters = reactive<{ search?: string; types: string[] }>({ search: 'kit', types: [] });
		const wrapper = mountList(filters);

		wrapper.findComponent({ name: 'ListFilterBar' }).vm.$emit('update:search', '');
		await nextTick();

		expect(filters.search).toBeUndefined();
	});
});
