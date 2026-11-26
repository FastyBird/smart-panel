import type { Ref } from 'vue';

import { ElPagination } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { ListFilterBar } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import type { IUser } from '../store/users.store.types';

import type { IListUsersProps } from './list-users.types';
import ListUsers from './list-users.vue';
import UsersRowList from './users-row-list.vue';
import UsersTable from './users-table.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	isPhone: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { ref: vueRef } = await import('vue');

	mocks.isPhone = vueRef(false);

	return {
		...actual,
		// jsdom reports a narrow viewport; the tests pick the size class themselves
		useSizeClass: () => ({
			isPhone: mocks.isPhone,
			isTabletPortrait: vueRef(false),
			isTabletLandscape: vueRef(false),
			isDesktop: vueRef(true),
			isTouch: vueRef(false),
			sizeClass: vueRef('dt'),
		}),
	};
});

const user = (id: string, role: UsersModuleUserRole): IUser => ({
	id,
	username: `user-${id}`,
	firstName: null,
	lastName: null,
	email: `${id}@example.com`,
	role,
	language: null,
	draft: false,
	isHidden: false,
	createdAt: new Date(),
	updatedAt: null,
});

const USERS = [user('1', UsersModuleUserRole.admin), user('2', UsersModuleUserRole.owner)];

const mountList = (props: Partial<IListUsersProps> = {}) =>
	mount(ListUsers, {
		props: {
			items: USERS,
			allItems: USERS,
			totalRows: USERS.length,
			filters: { search: undefined, roles: [] },
			filtersActive: false,
			paginateSize: 10,
			paginatePage: 1,
			sortBy: 'username',
			sortDir: 'ascending',
			loading: false,
			...props,
		},
	});

describe('ListUsers', (): void => {
	beforeEach((): void => {
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

	afterEach((): void => {
		vi.unstubAllGlobals();
	});

	it('shows the filter bar and the table above phone width', (): void => {
		const wrapper = mountList();

		expect(wrapper.findComponent(ListFilterBar).exists()).toBe(true);
		expect(wrapper.findComponent(UsersTable).props('items')).toStrictEqual(USERS);
		expect(wrapper.findComponent(UsersRowList).exists()).toBe(false);
	});

	it('shows a row list instead of the table on phone', (): void => {
		mocks.isPhone.value = true;

		const wrapper = mountList({ currentUserId: '1' });

		expect(wrapper.findComponent(UsersTable).exists()).toBe(false);
		expect(wrapper.findComponent(UsersRowList).props('currentUserId')).toBe('1');
	});

	it('passes edit, remove and reset on from the table and from the rows', async (): Promise<void> => {
		const wrapper = mountList();

		wrapper.findComponent(UsersTable).vm.$emit('edit', '1');
		wrapper.findComponent(UsersTable).vm.$emit('remove', '1');
		wrapper.findComponent(UsersTable).vm.$emit('reset-filters');

		mocks.isPhone.value = true;
		await flushPromises();

		wrapper.findComponent(UsersRowList).vm.$emit('edit', '2');

		expect(wrapper.emitted('edit')).toEqual([['1'], ['2']]);
		expect(wrapper.emitted('remove')).toEqual([['1']]);
		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});

	it('searches through the filter bar, and counts the role filter as active', async (): Promise<void> => {
		const filters = { search: undefined as string | undefined, roles: [] as UsersModuleUserRole[] };

		const wrapper = mountList({ filters });

		expect(wrapper.findComponent(ListFilterBar).props('activeCount')).toBe(0);

		wrapper.findComponent(ListFilterBar).vm.$emit('update:search', 'admin');
		await flushPromises();

		expect(filters.search).toBe('admin');

		await wrapper.setProps({ filters: { search: 'admin', roles: [UsersModuleUserRole.admin] } });

		expect(wrapper.findComponent(ListFilterBar).props('search')).toBe('admin');
		expect(wrapper.findComponent(ListFilterBar).props('activeCount')).toBe(1);
	});

	it('deletes the selected rows in bulk', async (): Promise<void> => {
		const wrapper = mountList();

		wrapper.findComponent(UsersTable).vm.$emit('selected-changes', [USERS[0]]);
		await flushPromises();

		expect(wrapper.findComponent(ListFilterBar).props('selectedCount')).toBe(1);

		await wrapper.get('[data-test-id="bulk-delete"]').trigger('click');

		expect(wrapper.emitted('bulk-action')).toEqual([['delete', [USERS[0]]]]);
	});

	it('passes sorting and pagination on', async (): Promise<void> => {
		const wrapper = mountList();

		wrapper.findComponent(UsersTable).vm.$emit('update:sort-by', 'email');
		await flushPromises();

		expect(wrapper.emitted('update:sort-by')).toEqual([['email']]);

		const pagination = wrapper.findComponent(ElPagination);

		pagination.vm.$emit('current-change', 2);
		pagination.vm.$emit('size-change', 20);

		expect(wrapper.emitted('update:paginate-page')![0]).toEqual([2]);
		expect(wrapper.emitted('update:paginate-size')![0]).toEqual([20]);
	});

	it('keeps the sorting in step with the page', async (): Promise<void> => {
		const wrapper = mountList();

		await wrapper.setProps({ sortDir: 'descending' });

		expect(wrapper.findComponent(UsersTable).props('sortDir')).toBe('descending');
	});
});
