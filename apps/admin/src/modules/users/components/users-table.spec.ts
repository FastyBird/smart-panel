import { type ComponentPublicInstance } from 'vue';

import { ElButton, ElTable, ElTableColumn } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { UsersUserRole } from '../../../openapi';
import type { IUser } from '../store';

import { UsersTable } from './index';
import type { IUsersTableProps } from './users-table.types';

type UsersTableInstance = ComponentPublicInstance<IUsersTableProps>;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('UsersTable', (): void => {
	let wrapper: VueWrapper<UsersTableInstance>;

	const usersMock: IUser[] = [
		{
			id: '1',
			username: 'admin',
			firstName: 'Admin',
			lastName: 'User',
			email: 'admin@example.com',
			role: UsersUserRole.admin,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		},
		{
			id: '2',
			username: 'john',
			firstName: 'John',
			lastName: 'Doe',
			email: 'john@example.com',
			role: UsersUserRole.owner,
			draft: false,
			isHidden: false,
			createdAt: new Date(),
			updatedAt: null,
		},
	];

	const createWrapper = (props: Partial<IUsersTableProps> = {}): void => {
		wrapper = mount(UsersTable, {
			props: {
				items: usersMock,
				totalRows: usersMock.length,
				sortBy: 'username',
				sortDir: 'ascending',
				loading: false,
				filters: { search: undefined, roles: [] },
				filtersActive: false,
				...props,
			},
		});
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('renders the table properly', (): void => {
		createWrapper();

		expect(wrapper.findComponent(ElTable).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElTableColumn).length).toBeGreaterThan(0);
		expect(wrapper.findAll('tr').length).toBe(usersMock.length + 1); // +1 for header row
	});

	it('handles sorting changes', async (): Promise<void> => {
		createWrapper();

		wrapper.findComponent(ElTable).vm.$emit('sort-change', { order: 'descending' });

		expect(wrapper.emitted('update:sort-dir')).toBeTruthy();
		expect(wrapper.emitted('update:sort-dir')?.[0]).toEqual(['descending']);
	});

	it('handles selection changes', async (): Promise<void> => {
		createWrapper();

		wrapper.findComponent(ElTable).vm.$emit('selection-change', [usersMock[0]]);

		expect(wrapper.emitted('selected-changes')).toBeTruthy();
		expect(wrapper.emitted('selected-changes')?.[0]).toEqual([[usersMock[0]]]);
	});

	it('handles row click', async (): Promise<void> => {
		createWrapper();

		wrapper.findComponent(ElTable).vm.$emit('row-click', usersMock[1]);

		expect(wrapper.emitted('edit')).toBeTruthy();
		expect(wrapper.emitted('edit')?.[0]).toEqual(['2']);
	});

	it('displays "no users" message when table is empty', async (): Promise<void> => {
		createWrapper({ items: [], totalRows: 0 });

		expect(wrapper.text()).toContain('usersModule.texts.misc.noUsers');
	});

	it('displays "no filtered users" message when filtered results are empty', async (): Promise<void> => {
		createWrapper({ items: [], totalRows: 2, filtersActive: true });

		expect(wrapper.text()).toContain('usersModule.texts.misc.noFilteredUsers usersModule.buttons.resetFilters.title');
	});

	it('handles edit button click', async (): Promise<void> => {
		createWrapper();

		const table = wrapper.findComponent(ElTable);

		expect(table.exists()).toBe(true);

		await flushPromises();

		const firstRow = table.find('tbody tr');
		expect(firstRow.exists()).toBe(true);

		const lastCell = firstRow.find('td:last-child');
		expect(lastCell.exists()).toBe(true);

		const removeButton = lastCell.findAllComponents(ElButton).at(0);
		expect(removeButton).toBeTruthy();

		await removeButton?.trigger('click');

		expect(wrapper.emitted('edit')).toBeTruthy();
		expect(wrapper.emitted('edit')?.[0]).toEqual(['1']);
	});

	it('handles remove button click', async (): Promise<void> => {
		createWrapper();

		const table = wrapper.findComponent(ElTable);

		expect(table.exists()).toBe(true);

		await flushPromises();

		const firstRow = table.find('tbody tr');
		expect(firstRow.exists()).toBe(true);

		const lastCell = firstRow.find('td:last-child');
		expect(lastCell.exists()).toBe(true);

		const removeButton = lastCell.findAllComponents(ElButton).at(1);
		expect(removeButton).toBeTruthy();

		await removeButton?.trigger('click');

		expect(wrapper.emitted('remove')).toBeTruthy();
		expect(wrapper.emitted('remove')?.[0]).toEqual(['1']);
	});
});
