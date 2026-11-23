import { type ComponentPublicInstance, reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import type { INotificationsFilter } from '../schemas/list.schemas';

import NotificationsFilter from './notifications-filter.vue';

vi.mock('vue-i18n', () => ({
	// `common`'s index pulls in the app's locale setup, which builds a real i18n instance.
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

const mountFilter = async (props: Partial<{ filtersActive: boolean; selectedCount: number }> = {}): Promise<VueWrapper<ComponentPublicInstance>> => {
	const wrapper = mount(NotificationsFilter, {
		props: {
			filters: reactive<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false }),
			filtersActive: false,
			...props,
		},
		global: {
			// The drawer's body is only rendered while it is open
			stubs: {
				ElDrawer: { name: 'ElDrawer', props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
				ListNotificationsAdjust: { name: 'ListNotificationsAdjust', props: ['filters', 'filtersActive'], template: '<div />' },
				ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
				ElDropdownMenu: { template: '<ul><slot /></ul>' },
				ElDropdownItem: { template: '<li><slot /></li>' },
			},
		},
	});

	await flushPromises();

	return wrapper;
};

describe('NotificationsFilter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('opens the drawer that holds severity and source', async () => {
		const wrapper = await mountFilter();

		expect(wrapper.findComponent({ name: 'ListNotificationsAdjust' }).exists()).toBe(false);

		await wrapper.find('[data-test-id="adjust-notifications-filters"]').trigger('click');

		expect(wrapper.findComponent({ name: 'ListNotificationsAdjust' }).exists()).toBe(true);
	});

	it('keeps status and Unread only in the row itself', async () => {
		const wrapper = await mountFilter();

		expect(wrapper.find('[data-test-id="notifications-filter-status"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="unread-only-notifications"]').exists()).toBe(true);
	});

	it('shows the reset button only while a filter is active, and asks to reset from it', async () => {
		const wrapper = await mountFilter({ filtersActive: false });

		expect(wrapper.find('[data-test-id="reset-notifications-filters"]').exists()).toBe(false);

		await wrapper.setProps({ filtersActive: true });

		await wrapper.find('[data-test-id="reset-notifications-filters"]').trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('shows the bulk bar once rows are selected, Delete in the more menu, and forwards its actions', async () => {
		const wrapper = await mountFilter({ selectedCount: 0 });

		expect(wrapper.find('[data-test-id="notifications-filter-bulk"]').exists()).toBe(false);

		await wrapper.setProps({ selectedCount: 2 });

		expect(wrapper.text()).toContain('application.bulkActions.selected');

		const buttons = wrapper.findAll('button[data-test-id^="bulk-"]').map((button) => button.attributes('data-test-id'));

		expect(buttons).toEqual(['bulk-mark-read', 'bulk-mark-unread', 'bulk-dismiss', 'bulk-more']);
		expect(wrapper.find('[data-test-id="bulk-delete"]').classes()).toContain('text-danger!');

		await wrapper.find('[data-test-id="bulk-dismiss"]').trigger('click');
		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'delete');
		await wrapper.find('[data-test-id="notifications-clear-selection"]').trigger('click');

		expect(wrapper.emitted('bulk-action')).toEqual([['dismiss'], ['delete']]);
		expect(wrapper.emitted('clear-selection')).toHaveLength(1);
	});
});
