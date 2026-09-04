import { type ComponentPublicInstance, reactive, ref } from 'vue';

import { ElCheckbox } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';

import ListNotificationsAdjust from './list-notifications-adjust.vue';

const mockFetchExtensions = vi.fn();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../extensions/composables/useExtensions', () => ({
	useExtensions: () => ({
		extensions: ref([{ type: 'system-module', name: 'System' }]),
		areLoading: ref(false),
		fetchExtensions: mockFetchExtensions,
	}),
}));

const mountAdjust = async (
	props: Partial<{ filters: INotificationsFilter; filtersActive: boolean }> = {}
): Promise<VueWrapper<ComponentPublicInstance>> => {
	const wrapper = mount(ListNotificationsAdjust, {
		props: {
			filters: reactive<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false }),
			filtersActive: false,
			...props,
		},
	});

	await flushPromises();

	return wrapper;
};

describe('ListNotificationsAdjust', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads the extension list the source options are built from', async () => {
		await mountAdjust();

		expect(mockFetchExtensions).toHaveBeenCalledTimes(1);
	});

	it('offers one checkbox per severity and writes the selection into the filters', async () => {
		const filters = reactive<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false });

		const wrapper = await mountAdjust({ filters });

		const checkboxes = wrapper.findAllComponents(ElCheckbox);

		expect(checkboxes.map((checkbox) => checkbox.props('value'))).toEqual(Object.values(NotificationsModuleNotificationSeverity));

		await checkboxes[2].find('input').setValue(true);

		expect(filters.severity).toEqual([NotificationsModuleNotificationSeverity.error]);
	});

	it('enables the reset button only while a filter is active, and asks to reset from it', async () => {
		const wrapper = await mountAdjust({ filtersActive: false });

		const button = wrapper.find('[data-test-id="reset-notifications-filters-adjust"]');

		expect(button.attributes('disabled')).toBeDefined();

		await wrapper.setProps({ filtersActive: true });

		expect(button.attributes('disabled')).toBeUndefined();

		await button.trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});
});
