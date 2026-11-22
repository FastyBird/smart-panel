/* eslint-disable vue/one-component-per-file -- stubs of the child components */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { SizeClass } from '../../../../common/composables/types';
import type { IAutomationsFilter } from '../../composables/types';

import type { IListAutomationsProps } from './list-automations.types';
import ListAutomations from './list-automations.vue';

const sizeClass = ref<SizeClass>('dt');
const focusSearch = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useSizeClass: () => ({
			sizeClass,
			isPhone: computed(() => sizeClass.value === 'phone'),
			isTabletPortrait: computed(() => sizeClass.value === 'tp'),
			isTabletLandscape: computed(() => sizeClass.value === 'tl'),
			isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
			isTouch: computed(() => false),
		}),
		// Renders the filters drawer body so the wiring between the list and its bar can be checked
		ListFilterBar: defineComponent({
			name: 'ListFilterBar',
			props: {
				search: { type: String, default: '' },
				searchPlaceholder: { type: String, default: '' },
				quickFilters: { type: Array, default: () => [] },
				activeCount: { type: Number, default: 0 },
			},
			emits: ['update:search', 'quick-filter', 'reset'],
			setup: (_, { expose }) => expose({ focusSearch }),
			template: '<div data-test-id="filter-bar"><slot name="filters" /></div>',
		}),
	};
});

vi.mock('./list-automations-adjust.vue', () => ({
	default: defineComponent({ name: 'ListAutomationsAdjust', template: '<div data-test-id="adjust" />' }),
}));

vi.mock('./automations-table.vue', () => ({
	default: defineComponent({ name: 'AutomationsTable', emits: ['edit'], template: '<div data-test-id="automations-table" />' }),
}));

vi.mock('./automations-row-list.vue', () => ({
	default: defineComponent({ name: 'AutomationsRowList', emits: ['edit'], template: '<div data-test-id="automations-row-list" />' }),
}));

const filters = (overrides: Partial<IAutomationsFilter> = {}): IAutomationsFilter => ({
	search: undefined,
	spaceId: undefined,
	enabled: 'all',
	statuses: [],
	...overrides,
});

const render = (overrides: Partial<IListAutomationsProps> = {}) =>
	mount(ListAutomations, {
		props: {
			items: [],
			allItems: [],
			totalRows: 0,
			filters: filters(),
			filtersActive: false,
			paginateSize: 10,
			paginatePage: 1,
			sortBy: undefined,
			sortDir: null,
			loading: false,
			updating: [],
			...overrides,
		},
		global: { stubs: { ElPagination: true } },
	});

const bar = (wrapper: ReturnType<typeof render>) => wrapper.findComponent({ name: 'ListFilterBar' });

describe('ListAutomations', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
		vi.clearAllMocks();
	});

	it('puts the filter bar, the table and the pagination in one card, with status and space in the filters drawer', () => {
		const card = render().find('.el-card');

		expect(card.find('[data-test-id="filter-bar"] [data-test-id="adjust"]').exists()).toBe(true);
		expect(card.find('[data-test-id="automations-table"]').exists()).toBe(true);
		expect(card.findComponent({ name: 'ElPagination' }).exists()).toBe(true);
	});

	it('shows a row list instead of the table on phone', () => {
		sizeClass.value = 'phone';

		const wrapper = render();

		expect(wrapper.find('[data-test-id="automations-row-list-scroll"] [data-test-id="automations-row-list"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="automations-table"]').exists()).toBe(false);
	});

	it('offers Enabled as the quick filter and sets it', () => {
		const current = filters({ enabled: 'disabled' });
		const wrapper = render({ filters: current });

		expect(bar(wrapper).props('quickFilters')).toEqual([expect.objectContaining({ id: 'enabled', value: 'disabled' })]);

		bar(wrapper).vm.$emit('quick-filter', 'enabled', null);

		expect(current.enabled).toBe('all');
	});

	it('counts the active filters without the search', () => {
		const wrapper = render({ filters: filters({ search: 'lights', enabled: 'enabled', statuses: ['invalid' as never], spaceId: 'whole_home' }) });

		expect(bar(wrapper).props('activeCount')).toBe(3);
	});

	it('passes the search through, clearing it to undefined, and resets from the bar', () => {
		const current = filters({ search: 'lights' });
		const wrapper = render({ filters: current });

		expect(bar(wrapper).props('search')).toBe('lights');

		bar(wrapper).vm.$emit('update:search', '');
		bar(wrapper).vm.$emit('reset');

		expect(current.search).toBeUndefined();
		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('hands focus to the search field for the phone app bar', () => {
		(render().vm as unknown as { focusSearch: () => void }).focusSearch();

		expect(focusSearch).toHaveBeenCalledTimes(1);
	});
});
