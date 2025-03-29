import type { IUsersFilter } from '../composables';
import type { IUser } from '../store';

export interface IUsersTableProps {
	items: IUser[];
	totalRows: number;
	sortBy: 'username' | 'firstName' | 'lastName' | 'email' | 'role';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
	filters: IUsersFilter;
	filtersActive: boolean;
}
