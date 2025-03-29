import type { I18n } from 'vue-i18n';
import type { Router } from 'vue-router';

import type { Pinia } from 'pinia';

import type { MessageSchema } from './locales';
import { UsersUserRole } from './openapi';

export interface IModuleOptions {
	router: Router;
	store: Pinia;
	i18n: I18n<{ 'en-US': MessageSchema }>;
}

export interface IPluginOptions {
	router: Router;
	store: Pinia;
	i18n: I18n<{ 'en-US': MessageSchema }>;
}

export interface IAppUser {
	id: string;
	role: UsersUserRole;
	email?: string | null;
}
