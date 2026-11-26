import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { ListFilterBar } from '../../../common';
import type { IExtensionsFilter } from '../composables/types';
import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import type { IListExtensionsProps } from './list-extensions.types';
import ListExtensions from './list-extensions.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	isPhone: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { ref } = await import('vue');

	mocks.isPhone = ref(false);

	return {
		...actual,
		// jsdom reports a narrow viewport; the tests pick the size class themselves
		useSizeClass: () => ({
			isPhone: mocks.isPhone,
			isTabletPortrait: ref(false),
			isTabletLandscape: ref(false),
			isDesktop: ref(true),
			isTouch: ref(false),
			sizeClass: ref('dt'),
		}),
	};
});

// The cards and the table have their own specs; here they only need to be told apart
vi.mock('./extensions-cards.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'ExtensionsCards',
			props: ['items', 'loading', 'filtersActive'],
			emits: ['detail', 'toggle-enabled', 'reset-filters'],
			setup: () => () => h('div'),
		}),
	};
});

vi.mock('./extensions-table.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'ExtensionsTable',
			props: ['items', 'totalRows', 'loading', 'filtersActive', 'tableHeight', 'sortBy', 'sortDir'],
			emits: ['detail', 'toggle-enabled', 'reset-filters', 'selected-changes', 'update:sort-by', 'update:sort-dir'],
			setup: (_, { expose }) => {
				expose({ clearSelection: vi.fn() });

				return () => h('div');
			},
		}),
	};
});

const extension = (type: string): IExtension =>
	({
		type,
		name: type,
		kind: ExtensionKind.plugin,
		enabled: true,
		isCore: false,
		canToggleEnabled: true,
	}) as IExtension;

const EXTENSIONS = [extension('devices-shelly-ng-plugin'), extension('weather-openweathermap-plugin')];

const defaultFilters = (): IExtensionsFilter => ({ search: undefined, kind: 'all', enabled: 'all', isCore: 'all' });

const mountList = (props: Partial<IListExtensionsProps> = {}) =>
	mount(ListExtensions, {
		props: {
			items: EXTENSIONS,
			allItems: EXTENSIONS,
			totalRows: EXTENSIONS.length,
			filters: defaultFilters(),
			viewMode: 'table',
			paginateSize: 10,
			paginatePage: 1,
			...props,
		},
	});

const bar = (wrapper: ReturnType<typeof mountList>) => wrapper.findComponent(ListFilterBar);

describe('ListExtensions', () => {
	beforeEach(() => {
		mocks.isPhone.value = false;

		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe(): void {}
				unobserve(): void {}
				disconnect(): void {}
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('shows the view picked: the table, or the cards', async () => {
		const wrapper = mountList();

		expect(wrapper.findComponent({ name: 'ExtensionsTable' }).exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'ExtensionsCards' }).exists()).toBe(false);

		await wrapper.setProps({ viewMode: 'cards' });

		expect(wrapper.findComponent({ name: 'ExtensionsTable' }).exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'ExtensionsCards' }).props('items')).toStrictEqual(EXTENSIONS);
	});

	it('shows the cards on phone whichever view was picked', () => {
		mocks.isPhone.value = true;

		const wrapper = mountList({ viewMode: 'table' });

		expect(wrapper.findComponent({ name: 'ExtensionsTable' }).exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'ExtensionsCards' }).exists()).toBe(true);
	});

	it('offers kind, status and origin as quick filters, and sets the filter a choice names', async () => {
		const filters = defaultFilters();
		const wrapper = mountList({ filters });

		expect((bar(wrapper).props('quickFilters') ?? []).map((filter) => filter.id)).toEqual(['kind', 'enabled', 'isCore']);
		expect(bar(wrapper).props('activeCount')).toBe(0);

		bar(wrapper).vm.$emit('quick-filter', 'kind', ExtensionKind.module);
		bar(wrapper).vm.$emit('quick-filter', 'enabled', 'disabled');
		bar(wrapper).vm.$emit('quick-filter', 'isCore', 'core');
		await flushPromises();

		expect(filters).toMatchObject({ kind: ExtensionKind.module, enabled: 'disabled', isCore: 'core' });

		// Clearing a quick filter goes back to All
		bar(wrapper).vm.$emit('quick-filter', 'kind', null);
		await flushPromises();

		expect(filters.kind).toBe('all');
	});

	it('counts the active filters, the search left out', () => {
		const wrapper = mountList({ filters: { search: 'shelly', kind: ExtensionKind.plugin, enabled: 'enabled', isCore: 'all' } });

		expect(bar(wrapper).props('search')).toBe('shelly');
		expect(bar(wrapper).props('activeCount')).toBe(2);
	});

	it('enables and disables the rows selected in the table, and forgets them in the cards', async () => {
		const wrapper = mountList();

		wrapper.findComponent({ name: 'ExtensionsTable' }).vm.$emit('selected-changes', [EXTENSIONS[0]]);
		await flushPromises();

		expect(bar(wrapper).props('selectedCount')).toBe(1);

		await wrapper.get('[data-test-id="bulk-enable"]').trigger('click');
		await wrapper.get('[data-test-id="bulk-disable"]').trigger('click');

		expect(wrapper.emitted('bulk-action')).toEqual([
			['enable', [EXTENSIONS[0]]],
			['disable', [EXTENSIONS[0]]],
		]);

		await wrapper.setProps({ viewMode: 'cards' });

		expect(bar(wrapper).props('selectedCount')).toBe(0);
	});

	it('passes detail and the enabled switch on from either view', async () => {
		const wrapper = mountList();

		wrapper.findComponent({ name: 'ExtensionsTable' }).vm.$emit('detail', 'devices-shelly-ng-plugin');
		wrapper.findComponent({ name: 'ExtensionsTable' }).vm.$emit('toggle-enabled', 'devices-shelly-ng-plugin', false);

		await wrapper.setProps({ viewMode: 'cards' });

		wrapper.findComponent({ name: 'ExtensionsCards' }).vm.$emit('detail', 'weather-openweathermap-plugin');

		expect(wrapper.emitted('detail')).toEqual([['devices-shelly-ng-plugin'], ['weather-openweathermap-plugin']]);
		expect(wrapper.emitted('toggle-enabled')).toEqual([['devices-shelly-ng-plugin', false]]);
	});
});
