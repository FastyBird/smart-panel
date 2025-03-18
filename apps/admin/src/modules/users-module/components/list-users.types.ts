import type { IUser } from '../store';
import type { UserRole } from '../users.constants';

export interface IListUsersFilterFields {
	search: string | undefined;
	role: UserRole | null;
}

export interface IListUsersProps {
	items: IUser[];
	allItems: IUser[];
	totalRows: number;
	filters: IListUsersFilterFields;
	paginateSize: number;
	paginatePage: number;
	sortBy: 'username' | 'firstName' | 'lastName' | 'email' | 'role';
	sortDir: 'ascending' | 'descending' | null;
	loading: boolean;
}
