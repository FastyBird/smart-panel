import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { MCP_MODULE_NAME, RouteNames } from '../mcp.constants';

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
			icon: 'mdi:power-plug-outline',
			menu: 3800,
			menuGroup: 'integrations',
			module: MCP_MODULE_NAME,
		},
	},
	{
		path: 'mcp-oauth',
		name: RouteNames.OAUTH_MANAGEMENT,
		component: () => import('../views/view-mcp-oauth-management.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('mcpModule.menu.oauth'),
			icon: 'mdi:shield-key-outline',
			menu: 3700,
			menuGroup: 'integrations',
			module: MCP_MODULE_NAME,
			// The provider's endpoints are not mounted while this is off, so the
			// page would have nothing to show.
			moduleFlag: 'oauthEnabled',
		},
	},
];

/**
 * Template 10, standalone: the OAuth consent screen is seen by someone coming from another app, so it stands on its own
 * page without the sidebar and the header. Added at the top level of the router, not under the app shell
 */
export const ModuleStandaloneRoutes: RouteRecordRaw[] = [
	{
		path: '/mcp-oauth-consent',
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
