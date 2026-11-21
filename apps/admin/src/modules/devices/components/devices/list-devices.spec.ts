/* eslint-disable vue/one-component-per-file -- stubs of the child components */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { SizeClass } from '../../../../common/composables/types';
import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import type { IDevicesFilter } from '../../composables/types';
import type { IDevice } from '../../store/devices.store.types';

import type { IListDevicesProps } from './list-devices.types';
import ListDevices from './list-devices.vue';

const sizeClass = ref<SizeClass>('dt');
const clearSelection = vi.fn();
const focusSearch = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
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
		useBreakpoints: () => ({ isMDDevice: computed(() => sizeClass.value !== 'phone') }),
		// Renders the slots and re-emits, so the wiring between the list and its bar can be checked
		ListFilterBar: defineComponent({
			name: 'ListFilterBar',
			props: ['search', 'searchPlaceholder', 'quickFilters', 'activeCount', 'selectedCount'],
			emits: ['update:search', 'quick-filter', 'reset', 'clear-selection'],
			setup: (_, { expose }) => expose({ focusSearch }),
			template: '<div data-test-id="filter-bar"><slot name="filters" /><slot name="bulk" /></div>',
		}),
	};
});

vi.mock('./list-devices-adjust.vue', () => ({ default: defineComponent({ name: 'ListDevicesAdjust', template: '<div />' }) }));

vi.mock('./devices-table.vue', () => ({
	default: defineComponent({
		name: 'DevicesTable',
		emits: ['selected-changes', 'detail'],
		setup: (_, { expose }) => expose({ clearSelection }),
		template: '<div data-test-id="devices-table" />',
	}),
}));

vi.mock('./devices-row-list.vue', () => ({
	default: defineComponent({ name: 'DevicesRowList', emits: ['detail'], template: '<div data-test-id="devices-row-list" />' }),
}));

const filters = (overrides: Partial<IDevicesFilter> = {}): IDevicesFilter => ({
	search: undefined,
	types: [],
	state: 'all',
	states: [],
	categories: [],
	enabled: 'all',
	validation: 'all',
	...overrides,
});

const render = (overrides: Partial<IListDevicesProps> = {}) =>
	mount(ListDevices, {
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
			showHidden: false,
			...overrides,
		},
		global: { stubs: { ElPagination: true } },
	});

const bar = (wrapper: ReturnType<typeof render>) => wrapper.findComponent({ name: 'ListFilterBar' });

describe('ListDevices', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
		vi.clearAllMocks();
	});

	it('puts the filter bar, the table and the pagination in one card', () => {
		const wrapper = render();

		const card = wrapper.find('.el-card');

		expect(card.find('[data-test-id="filter-bar"]').exists()).toBe(true);
		expect(card.find('[data-test-id="devices-table"]').exists()).toBe(true);
		expect(card.findComponent({ name: 'ElPagination' }).exists()).toBe(true);
	});

	it('shows a row list instead of the table on phone', () => {
		sizeClass.value = 'phone';

		const wrapper = render();

		expect(wrapper.find('[data-test-id="devices-row-list"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="devices-table"]').exists()).toBe(false);
	});

	it('offers the connection state as the quick filter and sets it', async () => {
		// The filters object is shared with the data source and changed in place, as the other list filters do
		const current = filters({ state: 'offline' });
		const wrapper = render({ filters: current });

		expect(bar(wrapper).props('quickFilters')).toEqual([expect.objectContaining({ id: 'state', value: 'offline' })]);

		bar(wrapper).vm.$emit('quick-filter', 'state', null);

		expect(current.state).toBe('all');
	});

	it('counts the active filters without the search', () => {
		const wrapper = render({
			filters: filters({ search: 'lamp', state: 'online', types: ['shelly'], categories: [DevicesModuleDeviceCategory.lighting] }),
		});

		expect(bar(wrapper).props('activeCount')).toBe(3);
	});

	it('passes the search through, clearing it to undefined', async () => {
		const current = filters({ search: 'lamp' });
		const wrapper = render({ filters: current });

		expect(bar(wrapper).props('search')).toBe('lamp');

		bar(wrapper).vm.$emit('update:search', '');

		expect(current.search).toBeUndefined();
	});

	it('resets the filters from the bar', () => {
		const wrapper = render();

		bar(wrapper).vm.$emit('reset');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('runs a bulk action on the selected rows and clears the selection from the bar', async () => {
		const wrapper = render();
		const selected = [{ id: 'device-1' }] as IDevice[];

		wrapper.findComponent({ name: 'DevicesTable' }).vm.$emit('selected-changes', selected);
		await wrapper.vm.$nextTick();

		expect(bar(wrapper).props('selectedCount')).toBe(1);

		await wrapper.find('[data-test-id="bulk-delete"]').trigger('click');

		expect(wrapper.emitted('bulk-action')).toEqual([['delete', selected]]);

		bar(wrapper).vm.$emit('clear-selection');
		await wrapper.vm.$nextTick();

		expect(clearSelection).toHaveBeenCalledTimes(1);
		expect(bar(wrapper).props('selectedCount')).toBe(0);
	});

	it('keeps Show hidden in the filters drawer', () => {
		expect(render().find('[data-test-id="filter-bar"] [data-test-id="show-hidden-devices"]').exists()).toBe(true);
	});

	it('hands focus to the search field for the phone app bar', () => {
		const wrapper = render();

		(wrapper.vm as unknown as { focusSearch: () => void }).focusSearch();

		expect(focusSearch).toHaveBeenCalledTimes(1);
	});
});
