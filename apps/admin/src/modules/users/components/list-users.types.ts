import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

export interface IListUsersProps {
	items: IUser[];
	allItems: IUser[];
	totalRows: number;
	filters: IUsersFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'username' | 'firstName' | 'lastName' | 'email' | 'role';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}
