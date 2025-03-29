import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import { UsersUserRole } from '../../../openapi';
import type { IUser } from '../store';
import type { FormResultType } from '../users.constants';

export interface IUsersFilter {
	search: string | undefined;
	roles: UsersUserRole[];
}

export interface IUserAddForm {
	username: string;
	password: string;
	repeatPassword: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UsersUserRole;
}

export interface IUserEditForm {
	username: string;
	password: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UsersUserRole;
}

export interface IUserPasswordForm {
	password: string;
	repeatPassword: string;
}

export interface IUserUsernameForm {
	username: string;
}

export interface IUseUser {
	user: ComputedRef<IUser | null>;
	isLoading: ComputedRef<boolean>;
	fetchUser: () => Promise<void>;
}

export interface IUseUsersDataSource {
	users: ComputedRef<IUser[]>;
	usersPaginated: ComputedRef<IUser[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchUsers: () => Promise<void>;
	filters: Ref<IUsersFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseUsersActions {
	remove: (id: IUser['id']) => Promise<void>;
}

export interface IUseUserAddForm {
	model: Reactive<IUserAddForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseUserEditForm {
	model: Reactive<IUserEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseUserPasswordForm {
	model: Reactive<IUserPasswordForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseUserUsernameForm {
	model: Reactive<IUserUsernameForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
