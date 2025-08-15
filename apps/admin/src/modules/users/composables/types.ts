import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import { UsersModuleUserRole } from '../../../openapi';
import type { IDisplayInstance } from '../store/displays-instances.store.types';
import type { IUser } from '../store/users.store.types';
import type { FormResultType } from '../users.constants';

export interface IDisplaysInstancesFilter {
	search: string | undefined;
}

export interface IUsersFilter {
	search: string | undefined;
	roles: UsersModuleUserRole[];
}

export interface IUseDisplayInstance {
	display: ComputedRef<IDisplayInstance | null>;
	isLoading: ComputedRef<boolean>;
	fetchDisplay: () => Promise<void>;
}

export interface IUseDisplaysInstances {
	displays: ComputedRef<IDisplayInstance[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
}

export interface IUseDisplaysInstancesActions {
	remove: (id: IDisplayInstance['id']) => Promise<void>;
}

export interface IUseDisplaysInstancesDataSource {
	displays: ComputedRef<IDisplayInstance[]>;
	displaysPaginated: ComputedRef<IDisplayInstance[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	filters: Ref<IDisplaysInstancesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'uid' | 'mac' | 'version' | 'build' | 'user'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUserAddForm {
	username: string;
	password: string;
	repeatPassword: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UsersModuleUserRole;
}

export interface IUserEditForm {
	username: string;
	password: string;
	email: string;
	firstName: string;
	lastName: string;
	role: UsersModuleUserRole;
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
