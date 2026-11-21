import { computed, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';

import type { ListFilterBarProps, ListFilterBarQuickFilter } from './list-filter-bar.types';
import ListFilterBar from './list-filter-bar.vue';

const sizeClass = ref<SizeClass>('dt');

vi.mock('../composables/useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const QUICK_FILTERS: ListFilterBarQuickFilter[] = [
	{
		id: 'integration',
		label: 'Integration',
		options: [
			{ value: 'shelly', label: 'Shelly' },
			{ value: 'z2m', label: 'Zigbee2MQTT' },
		],
	},
	{
		id: 'state',
		label: 'State',
		options: [
			{ value: 'online', label: 'Online' },
			{ value: 'offline', label: 'Offline' },
		],
		value: 'offline',
	},
];

const render = (props: ListFilterBarProps = {}, slots: Record<string, string> = {}) =>
	mount(ListFilterBar, {
		props,
		slots,
		global: {
			plugins: [i18n],
			stubs: {
				// The drawer body renders only while it is open
				ElDrawer: {
					props: ['modelValue', 'title', 'size'],
					template: '<div v-if="modelValue" :data-size="size" :data-title="title"><slot /><slot name="footer" /></div>',
				},
				// The menu is teleported by Element Plus; render it inline so its items can be clicked
				ElDropdown: {
					emits: ['command'],
					template: '<div><slot /><slot name="dropdown" /></div>',
					provide() {
						return { stubDropdown: this };
					},
				},
				ElDropdownMenu: { template: '<ul><slot /></ul>' },
				ElDropdownItem: {
					props: ['command'],
					inject: ['stubDropdown'],
					template: '<li data-test-id="dropdown-item" @click="stubDropdown.$emit(\'command\', command)"><slot /></li>',
				},
				ElSelect: {
					props: ['modelValue'],
					emits: ['update:modelValue'],
					template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="" /><slot /></select>',
				},
				ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
			},
		},
	});

const find = (wrapper: ReturnType<typeof render>, id: string) => wrapper.find(`[data-test-id="list-filter-bar-${id}"]`);

describe('ListFilterBar.vue', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('emits the search text', async () => {
		const wrapper = render({ search: 'lamp', searchPlaceholder: 'Search devices' });

		const input = wrapper.find<HTMLInputElement>('input');

		expect(input.element.value).toBe('lamp');
		expect(input.attributes('placeholder')).toBe('Search devices');
		expect(input.attributes('aria-label')).toBe('Search devices');

		await input.setValue('kitchen');

		expect(wrapper.emitted('update:search')?.at(-1)).toEqual(['kitchen']);
	});

	it('shows each quick filter as "Label: value" in the bar on desktop', () => {
		const wrapper = render({ quickFilters: QUICK_FILTERS });

		const triggers = wrapper.findAll('[data-test-id="list-filter-bar-quick-filter-trigger"]');

		expect(triggers.map((trigger) => trigger.text())).toEqual(['Integration: All', 'State: Offline']);
	});

	it('marks an active quick filter and clears it with its × button', async () => {
		const wrapper = render({ quickFilters: QUICK_FILTERS });

		const chips = wrapper.findAll('[data-test-id="list-filter-bar-quick-filter"]');

		expect(chips[0].classes()).not.toContain('bg-primary-soft');
		expect(chips[1].classes()).toContain('bg-primary-soft');
		expect(chips[0].find('[data-test-id="list-filter-bar-quick-filter-clear"]').exists()).toBe(false);

		const clear = chips[1].find('[data-test-id="list-filter-bar-quick-filter-clear"]');

		expect(clear.attributes('aria-label')).toBe('Clear the State filter');

		await clear.trigger('click');

		expect(wrapper.emitted('quick-filter')).toEqual([['state', null]]);
	});

	it('emits the chosen quick filter option, or null for All', async () => {
		const wrapper = render({ quickFilters: QUICK_FILTERS });

		const items = wrapper.findAll('[data-filter-id="integration"] [data-test-id="dropdown-item"]');

		expect(items.map((item) => item.text())).toEqual(['All', 'Shelly', 'Zigbee2MQTT']);

		await items[2].trigger('click');
		await items[0].trigger('click');

		expect(wrapper.emitted('quick-filter')).toEqual([
			['integration', 'z2m'],
			['integration', null],
		]);
	});

	it('keeps at most three quick filters in the bar', () => {
		const many = [1, 2, 3, 4].map((n) => ({ id: `f${n}`, label: `F${n}`, options: [] }));

		expect(render({ quickFilters: many }).findAll('[data-test-id="list-filter-bar-quick-filter"]')).toHaveLength(3);
	});

	it('opens the filters slot in a 320 px drawer and counts the active filters', async () => {
		const wrapper = render({ activeCount: 2 }, { filters: '<div data-test-id="extra-filters" />' });

		expect(find(wrapper, 'filters').text()).toBe('Filters · 2');
		expect(wrapper.find('[data-test-id="extra-filters"]').exists()).toBe(false);

		await find(wrapper, 'filters').trigger('click');

		expect(find(wrapper, 'drawer').attributes('data-size')).toBe('320px');
		expect(find(wrapper, 'drawer').attributes('data-title')).toBe('Filters');
		expect(wrapper.find('[data-test-id="extra-filters"]').exists()).toBe(true);

		await find(wrapper, 'drawer-done').trigger('click');

		expect(find(wrapper, 'drawer').exists()).toBe(false);
	});

	it('has no Filters button on desktop without a filters slot', () => {
		const wrapper = render({ quickFilters: QUICK_FILTERS });

		expect(find(wrapper, 'filters').exists()).toBe(false);
	});

	it.each<SizeClass>(['phone', 'tp', 'tl'])('moves the quick filters into the drawer below desktop (%s)', async (size) => {
		sizeClass.value = size;

		const wrapper = render({ quickFilters: QUICK_FILTERS, activeCount: 1 });

		expect(wrapper.find('[data-test-id="list-filter-bar-quick-filter"]').exists()).toBe(false);

		await find(wrapper, 'filters').trigger('click');

		expect(find(wrapper, 'drawer').attributes('data-size')).toBe(size === 'phone' ? '100%' : '320px');

		const selects = wrapper.findAll('[data-test-id="list-filter-bar-drawer-quick-filter"]');

		expect(selects).toHaveLength(2);
		expect((selects[1].element as HTMLSelectElement).value).toBe('offline');

		await selects[0].setValue('shelly');
		await selects[1].setValue('');

		expect(wrapper.emitted('quick-filter')).toEqual([
			['integration', 'shelly'],
			['state', null],
		]);
	});

	it('offers Reset only while filters are active', async () => {
		expect(find(render(), 'reset').exists()).toBe(false);

		const wrapper = render({ activeCount: 1 });

		await find(wrapper, 'reset').trigger('click');

		expect(wrapper.emitted('reset')).toHaveLength(1);
	});

	it('slides the bulk bar in under the filter row while rows are selected', async () => {
		const wrapper = render({ selectedCount: 0 }, { bulk: '<button data-test-id="bulk-delete">Delete</button>' });

		expect(find(wrapper, 'bulk').exists()).toBe(false);

		await wrapper.setProps({ selectedCount: 3 });

		expect(find(wrapper, 'search').exists()).toBe(true);
		expect(find(wrapper, 'bulk').text()).toContain('3 selected');
		expect(find(wrapper, 'bulk').find('[data-test-id="bulk-delete"]').exists()).toBe(true);
		expect(find(wrapper, 'bulk').find('[role="status"]').exists()).toBe(true);

		await find(wrapper, 'clear-selection').trigger('click');

		expect(wrapper.emitted('clear-selection')).toHaveLength(1);
	});
});
