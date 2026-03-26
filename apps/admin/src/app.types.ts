import type { I18n } from 'vue-i18n';
import type { Router } from 'vue-router';

import type { Pinia } from 'pinia';

import { UsersModuleUserRole } from './openapi.constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppI18n = I18n<any, any, any, string, boolean>;

export type IExtensionOptions = IModuleOptions & IPluginOptions;

export interface IModuleOptions {
	router: Router;
	store: Pinia;
	i18n: AppI18n;
}

export interface IPluginOptions {
	router: Router;
	store: Pinia;
	i18n: AppI18n;
}

export interface IAppUser {
	id: string;
	username: string;
	name?: string | null;
	email?: string | null;
	avatar?: string;
	role: UsersModuleUserRole;
}
