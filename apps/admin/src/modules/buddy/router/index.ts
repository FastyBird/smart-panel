import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { BUDDY_MODULE_NAME, RouteNames } from '../buddy.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'buddy',
		name: RouteNames.BUDDY,
		component: () => import('../views/view-buddy-chat.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('buddyModule.menu.title'),
			icon: 'mdi:robot-happy',
			menu: 10000,
			module: BUDDY_MODULE_NAME,
		},
		// Template 7: the chats and one conversation side by side from tablet landscape; below it the conversation is its
		// own page. The chat view stays the parent either way, so it owns the chats and the conversation's data
		children: [
			{
				path: ':id',
				name: RouteNames.BUDDY_CONVERSATION,
				component: () => import('../views/view-buddy-conversation.vue'),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: () => i18n.global.t('buddyModule.menu.title'),
				},
			},
		],
	},
	{
		// Template 9: the setup wizard is a page of its own
		path: 'buddy/setup',
		name: RouteNames.BUDDY_SETUP,
		component: () => import('../views/view-buddy-setup.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('buddyModule.wizard.title'),
		},
	},
];
