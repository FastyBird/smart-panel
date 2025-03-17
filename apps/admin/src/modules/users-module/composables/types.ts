import type { ComputedRef, Ref } from 'vue';

import type { IUser } from '../store';
import type { FormResultType, UserRole } from '../users.constants';

export interface IUsersFilter {
	search: string | undefined;
	role: UserRole | null;
}

export interface IUserAddForm {
	username: string;
	password: string;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	role: UserRole;
}

export interface IUserEditForm {
	username?: string;
	password?: string;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	role?: UserRole;
}

export interface IUseUser {
	user: ComputedRef<IUser | null>;
	isLoading: ComputedRef<boolean>;
	fetchUser: () => Promise<void>;
}

export interface IUseUsers {
	users: ComputedRef<IUser[]>;
	usersPaginated: ComputedRef<IUser[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchUsers: () => Promise<void>;
	filters: Ref<IUsersFilter>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseUserActions {
	remove: (id: IUser['id']) => Promise<void>;
}

export interface IUseUserAddForm {
	submit: (model: IUserAddForm) => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseUserEditForm {
	submit: (model: IUserEditForm) => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
