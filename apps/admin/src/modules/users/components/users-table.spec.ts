import { type ComponentPublicInstance } from 'vue';

import { ElButton, ElTable, ElTableColumn } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { UsersModuleUserRole } from '../../../openapi.constants';
import type { IUser } from '../store/users.store.types';

import UsersRowActions from './users-row-actions.vue';
import type { IUsersTableProps } from './users-table.types';
import UsersTable from './users-table.vue';

type UsersTableInstance = ComponentPublicInstance<IUsersTableProps>;

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		// Every column shows, as from tablet landscape up
		useSizeClass: () => ({ isTabletPortrait: { value: false } }),
	};
});

describe('UsersTable', (): void => {
	let wrapper: VueWrapper<UsersTableInstance>;

	const usersMock: IUser[] = [
		{
			id: '1',
			username: 'admin',
			firstName: 'Admin',
			lastName: 'User',
			email: 'admin@example.com',
			role: UsersModuleUserRole.admin,
			language: null,
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
			role: UsersModuleUserRole.owner,
			language: null,
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

		expect(wrapper.text()).toContain('usersModule.texts.misc.noFilteredUsers');
		expect(wrapper.text()).toContain('usersModule.buttons.resetFilters.title');
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

	it('removes a user from the row menu, which offers removal only where the backend allows it', async (): Promise<void> => {
		createWrapper({ currentUserId: '3' });

		await flushPromises();

		// Remove lives in the row's more menu (spec section 4)
		const actions = wrapper.findAllComponents(UsersRowActions);

		expect(actions).toHaveLength(2);
		expect(actions[0]!.props('removable')).toBe(true);
		// usersMock[1] is the owner
		expect(actions[1]!.props('removable')).toBe(false);

		actions[0]!.vm.$emit('remove', '1');

		expect(wrapper.emitted('remove')?.[0]).toEqual(['1']);
	});

	// The backend refuses both of these, so offering them for selection only
	// produces a failure the operator can do nothing about - and "select all"
	// would always report one.
	describe('protected rows', (): void => {
		const selectableFor = (props: Partial<IUsersTableProps> = {}): ((row: IUser) => boolean) => {
			createWrapper(props);

			const column = wrapper.findAllComponents(ElTableColumn).find((c) => c.props('type') === 'selection');

			return column!.props('selectable') as (row: IUser) => boolean;
		};

		it('does not let the owner account be selected', (): void => {
			const isSelectable = selectableFor();

			// usersMock[1] is the owner
			expect(isSelectable(usersMock[1]!)).toBe(false);
		});

		it('does not let the operator select their own account', (): void => {
			const isSelectable = selectableFor({ currentUserId: '1' });

			expect(isSelectable(usersMock[0]!)).toBe(false);
		});

		it('lets any other account be selected', (): void => {
			const isSelectable = selectableFor({ currentUserId: '2' });

			expect(isSelectable(usersMock[0]!)).toBe(true);
		});

		it('selects normally when the current user is unknown', (): void => {
			const isSelectable = selectableFor({ currentUserId: null });

			expect(isSelectable(usersMock[0]!)).toBe(true);
		});
	});
});
