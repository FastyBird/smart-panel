import type { IUsersFilter } from '../composables/types';
import type { IUser } from '../store/users.store.types';

export interface IUsersTableProps {
	items: IUser[];
	totalRows: number;
	sortBy: 'username' | 'firstName' | 'lastName' | 'email' | 'role';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IUsersFilter;
	filtersActive: boolean;
}
