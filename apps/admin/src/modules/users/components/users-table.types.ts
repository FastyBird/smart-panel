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
	tableHeight?: number;
	// Who is looking. The operator's own row cannot be selected for deletion, and
	// the table is presentational, so the identity is handed in rather than read
	// from the session here.
	currentUserId?: IUser['id'] | null;
}
