import { type ComponentPublicInstance } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElPagination } from 'element-plus';
import { beforeEach, describe, expect, it } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import enUS from '../locales/en-US.json';

import type { IListUsersProps } from './list-users.types';
import ListUsers from './list-users.vue';
import UsersFilter from './users-filter.vue';
import UsersTable from './users-table.vue';

type ListUsersInstance = ComponentPublicInstance<IListUsersProps> & {
	innerFilters: { search: string | undefined; roles: UsersUserRole[] };
};

describe('ListUsers', (): void => {
	let wrapper: VueWrapper<ListUsersInstance>;

	const defaultProps = {
		items: [],
		allItems: [],
		totalRows: 0,
		filters: { search: undefined, roles: [] },
		filtersActive: false,
		paginateSize: 10,
		paginatePage: 1,
		sortBy: 'username',
		sortDir: 'ascending',
		loading: false,
	};

	beforeEach((): void => {
		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					usersModule: enUS,
				},
			},
		});

		wrapper = mount(ListUsers, {
			global: {
				plugins: [i18n],
			},
			props: {
				items: defaultProps.items,
				allItems: defaultProps.allItems,
				totalRows: defaultProps.totalRows,
				filters: defaultProps.filters,
				filtersActive: defaultProps.filtersActive,
				paginateSize: defaultProps.paginateSize,
				paginatePage: defaultProps.paginatePage,
				sortBy: defaultProps.sortBy as 'username' | 'firstName' | 'lastName' | 'email' | 'role',
				sortDir: defaultProps.sortDir as 'ascending' | 'descending' | null,
				loading: defaultProps.loading,
			},
		}) as VueWrapper<ListUsersInstance>;
	});

	it('renders the component', (): void => {
		expect(wrapper.exists()).toBe(true);
	});

	it('renders UsersFilter and UsersTable components', (): void => {
		expect(wrapper.findComponent(UsersFilter).exists()).toBe(true);
		expect(wrapper.findComponent(UsersTable).exists()).toBe(true);
	});

	it('passes correct props to UsersTable', (): void => {
		const table = wrapper.findComponent(UsersTable);

		expect(table.props().items).toStrictEqual(defaultProps.items);
		expect(table.props().totalRows).toBe(defaultProps.totalRows);
		expect(table.props().loading).toBe(defaultProps.loading);
	});

	it('emits "edit" event when an edit action occurs', async (): Promise<void> => {
		wrapper.findComponent(UsersTable).vm.$emit('edit', 'user1');

		expect(wrapper.emitted('edit')![0]).toEqual(['user1']);
	});

	it('emits "remove" event when a remove action occurs', async (): Promise<void> => {
		wrapper.findComponent(UsersTable).vm.$emit('remove', 'user2');

		expect(wrapper.emitted('remove')![0]).toEqual(['user2']);
	});

	it('emits "reset-filters" when filters are reset', async (): Promise<void> => {
		wrapper.findComponent(UsersTable).vm.$emit('reset-filters');

		expect(wrapper.emitted('reset-filters')).toBeTruthy();
	});

	it('updates internal filters when v-model:filters changes', async (): Promise<void> => {
		await wrapper.setProps({ filters: { search: 'admin', roles: [UsersUserRole.admin] } });

		expect(wrapper.vm.innerFilters.search).toBe('admin');
		expect(wrapper.vm.innerFilters.roles).toEqual([UsersUserRole.admin]);

		expect(wrapper.findComponent(UsersFilter).props('filters')).toEqual({ search: 'admin', roles: [UsersUserRole.admin] });
	});

	it('emits "update:sort-by" when sortBy changes', async (): Promise<void> => {
		await wrapper.setProps({ sortBy: 'email' });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.sortBy).toBe('email');
		expect(wrapper.emitted('update:sort-by')![0]).toEqual(['email']);
	});

	it('emits "update:sort-dir" when sortDir changes', async (): Promise<void> => {
		await wrapper.setProps({ sortDir: 'descending' });

		await wrapper.vm.$nextTick();

		expect(wrapper.vm.sortDir).toBe('descending');
		expect(wrapper.emitted('update:sort-dir')![0]).toEqual(['descending']);
	});

	it('handles pagination events', async (): Promise<void> => {
		const pagination = wrapper.findComponent(ElPagination);

		pagination.vm.$emit('current-change', 2);
		pagination.vm.$emit('size-change', 20);

		expect(wrapper.emitted('update:paginate-page')![0]).toEqual([2]);
		expect(wrapper.emitted('update:paginate-size')![0]).toEqual([20]);
	});
});
