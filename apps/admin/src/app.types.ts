import type { I18n } from 'vue-i18n';
import type { Router } from 'vue-router';

import type { Pinia } from 'pinia';

import type { MessageSchema } from './locales';
import { UserRole } from './modules/users-module';

export interface IModuleOptions {
	router: Router;
	store: Pinia;
	i18n: I18n<{ 'en-US': MessageSchema }>;
}

export interface IAppUser {
	id: string;
	role: UserRole;
	email?: string | null;
}
