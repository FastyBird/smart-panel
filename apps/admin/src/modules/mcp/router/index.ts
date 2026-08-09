import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../mcp.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'mcp-clients',
		name: RouteNames.CLIENTS,
		component: () => import('../views/view-mcp-clients.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('mcpModule.menu.clients'),
			icon: 'mdi:robot-outline',
			menu: 6500,
		},
	},
	{
		path: 'mcp-oauth-consent',
		name: RouteNames.OAUTH_CONSENT,
		component: () => import('../views/view-mcp-oauth-consent.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('mcpModule.oauthConsent.title'),
		},
	},
];
