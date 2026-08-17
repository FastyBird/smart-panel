import { describe, expect, it } from 'vitest';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { MCP_MODULE_NAME, RouteNames } from '../mcp.constants';

import { ModuleRoutes } from './index';

describe('MCP routes', () => {
	it('restricts client management to owners and administrators', () => {
		expect(ModuleRoutes[0]?.meta?.guards).toEqual({
			authenticated: true,
			roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
		});
	});

	it('tags every menu route with the module so the navigation can hide it when disabled', () => {
		const menuRoutes = ModuleRoutes.filter(({ meta }) => meta?.menu !== undefined);

		expect(menuRoutes.length).toBeGreaterThan(0);

		// app-navigation only gates routes that declare `meta.module`; untagged
		// routes fall through to "always visible", which left the MCP items in
		// the menu while the module was disabled.
		for (const route of menuRoutes) {
			expect(route.meta?.module).toBe(MCP_MODULE_NAME);
		}
	});

	it('registers consent as a hidden owner/admin route', () => {
		const route = ModuleRoutes.find(({ name }) => name === RouteNames.OAUTH_CONSENT);

		expect(route?.path).toBe('mcp-oauth-consent');
		expect(route?.meta?.menu).toBeUndefined();
		expect(route?.meta?.guards).toEqual({
			authenticated: true,
			roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
		});
	});
});
