import { type ComponentPublicInstance, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import type { IBulkAction } from '../../../common';
import type { INotificationsFilter } from '../schemas/list.schemas';

import NotificationsFilter from './notifications-filter.vue';

const mockFetchExtensions = vi.fn();

vi.mock('vue-i18n', () => ({
	// `common`'s index pulls in the app's locale setup, which builds a real i18n instance.
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../extensions/composables/useExtensions', () => ({
	useExtensions: () => ({
		extensions: ref([{ type: 'system-module', name: 'System' }]),
		areLoading: ref(false),
		fetchExtensions: mockFetchExtensions,
	}),
}));

const bulkActions: IBulkAction[] = [{ key: 'dismiss', label: 'Dismiss', icon: 'mdi:eye-off-outline', type: 'warning' }];

const mountFilter = async (
	props: Partial<{ filtersActive: boolean; selectedCount: number; bulkActions: IBulkAction[] }> = {}
): Promise<VueWrapper<ComponentPublicInstance>> => {
	const wrapper = mount(NotificationsFilter, {
		props: {
			filters: reactive<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false }),
			filtersActive: false,
			bulkActions,
			...props,
		},
	});

	await flushPromises();

	return wrapper;
};

describe('NotificationsFilter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the extension list the source options are built from', async () => {
		await mountFilter();

		expect(mockFetchExtensions).toHaveBeenCalledTimes(1);
	});

	it('shows the reset button only while a filter is active, and asks to reset from it', async () => {
		const wrapper = await mountFilter({ filtersActive: false });

		expect(wrapper.find('[data-test-id="reset-notifications-filters"]').exists()).toBe(false);

		await wrapper.setProps({ filtersActive: true });

		await wrapper.find('[data-test-id="reset-notifications-filters"]').trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('shows the bulk toolbar once rows are selected and forwards its action', async () => {
		const wrapper = await mountFilter({ selectedCount: 0 });

		expect(wrapper.text()).not.toContain('application.bulkActions.selected');

		await wrapper.setProps({ selectedCount: 2 });

		expect(wrapper.text()).toContain('application.bulkActions.selected');

		const dismissButton = wrapper.findAll('button').find((button) => button.text() === 'Dismiss');

		await dismissButton?.trigger('click');

		expect(wrapper.emitted('bulk-action')).toEqual([['dismiss']]);
	});
});
