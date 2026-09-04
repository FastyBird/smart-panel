import { type ComponentPublicInstance, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationsTable from './notifications-table.vue';

vi.mock('vue-i18n', () => ({
	// `common`'s index pulls in the app's locale setup, which builds a real i18n instance.
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { ref: vueRef } = await import('vue');

	return {
		...actual,
		useBreakpoints: () => ({ isMDDevice: vueRef(true), isLGDevice: vueRef(true) }),
	};
});

vi.mock('../composables/composables', () => ({
	useNotificationAction: () => ({ execute: vi.fn(), isExecuting: ref(false) }),
}));

const notification = (overrides: Partial<INotification> = {}): INotification => ({
	id: 'a1111111-1111-4111-8111-111111111111',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.issue,
	key: 'update-available',
	severity: NotificationsModuleNotificationSeverity.warning,
	title: 'Update 2.4.0 is available',
	message: null,
	actions: [],
	data: null,
	persistent: false,
	occurrences: 1,
	readAt: null,
	dismissedAt: null,
	resolvedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: null,
	...overrides,
});

const defaultFilters = (): INotificationsFilter => ({ status: 'all', severity: [], source: undefined, unread: false });

const mountTable = async (
	props: Partial<{ items: INotification[]; loading: boolean; filtersActive: boolean; filters: INotificationsFilter }> = {}
): Promise<VueWrapper<ComponentPublicInstance>> => {
	const wrapper = mount(NotificationsTable, {
		props: {
			items: [],
			filters: reactive(defaultFilters()),
			loading: false,
			filtersActive: false,
			tableHeight: 400,
			...props,
		},
	});

	await flushPromises();

	return wrapper;
};

const renderedIcons = (wrapper: VueWrapper<ComponentPublicInstance>): string[] => wrapper.findAllComponents(Icon).map((icon) => icon.props('icon'));

describe('NotificationsTable', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('empty states', () => {
		it('shows the loading placeholder while the first page is being fetched', async () => {
			const wrapper = await mountTable({ loading: true });

			expect(renderedIcons(wrapper)).toContain('mdi:database-refresh');
			expect(wrapper.text()).not.toContain('notificationsModule.texts.notifications.noNotifications');
		});

		it('offers to reset the filters when they hide every row', async () => {
			const wrapper = await mountTable({ filtersActive: true });

			expect(wrapper.text()).toContain('notificationsModule.texts.notifications.noFilteredNotifications');

			await wrapper.find('[data-test-id="reset-notifications-filters-empty"]').trigger('click');

			expect(wrapper.emitted('reset-filters')).toHaveLength(1);
		});

		it('tells the operator there is nothing yet when no filter is active', async () => {
			const wrapper = await mountTable();

			expect(wrapper.text()).toContain('notificationsModule.texts.notifications.noNotifications');
			expect(wrapper.find('[data-test-id="reset-notifications-filters-empty"]').exists()).toBe(false);
		});
	});

	describe('rows', () => {
		it('opens the detail on a row click and through the detail button', async () => {
			const row = notification();

			const wrapper = await mountTable({ items: [row] });

			await wrapper.find('.el-table__row').trigger('click');
			await wrapper.find('[data-test-id="detail-notification"]').trigger('click');

			expect(wrapper.emitted('detail')).toEqual([[row.id], [row.id]]);
		});

		it('asks to dismiss and to remove a row from its action buttons without opening the detail', async () => {
			const row = notification();

			const wrapper = await mountTable({ items: [row] });

			await wrapper.find('[data-test-id="dismiss-notification"]').trigger('click');
			await wrapper.find('[data-test-id="remove-notification"]').trigger('click');

			expect(wrapper.emitted('dismiss')).toEqual([[row.id]]);
			expect(wrapper.emitted('remove')).toEqual([[row.id]]);
			expect(wrapper.emitted('detail')).toBeUndefined();
		});

		it('hides the dismiss button on a row that is already dismissed', async () => {
			const wrapper = await mountTable({ items: [notification({ dismissedAt: new Date('2026-01-02T00:00:00.000Z') })] });

			expect(wrapper.find('[data-test-id="dismiss-notification"]').exists()).toBe(false);
			expect(wrapper.find('[data-test-id="remove-notification"]').exists()).toBe(true);
		});

		it('marks unread rows and drops the marker once read', async () => {
			const wrapper = await mountTable({
				items: [
					notification({ id: 'a1111111-1111-4111-8111-111111111111' }),
					notification({ id: 'b2222222-2222-4222-8222-222222222222', readAt: new Date() }),
				],
			});

			const rows = wrapper.findAll('.el-table__row');

			expect(rows[0].find('.notifications-table__unread').exists()).toBe(true);
			expect(rows[1].find('.notifications-table__unread').exists()).toBe(false);
		});

		it('toggles the source filter from the source column', async () => {
			const filters = reactive(defaultFilters());
			const row = notification({ source: 'security-module' });

			const wrapper = await mountTable({ items: [row], filters });

			const sourceLink = wrapper.find('.el-table__row .el-link');

			await sourceLink.trigger('click');

			expect(filters.source).toBe('security-module');

			await sourceLink.trigger('click');

			expect(filters.source).toBeUndefined();
			expect(wrapper.emitted('detail')).toBeUndefined();
		});
	});
});
