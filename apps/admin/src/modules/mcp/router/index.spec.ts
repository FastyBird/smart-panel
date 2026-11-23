import { describe, expect, it } from 'vitest';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { MCP_MODULE_NAME, RouteNames } from '../mcp.constants';

import { ModuleRoutes, ModuleStandaloneRoutes } from './index';

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

	it('gates the oauth menu route on the oauth feature flag', () => {
		const route = ModuleRoutes.find(({ name }) => name === RouteNames.OAUTH_MANAGEMENT);

		// Module-enabled alone is not enough: the provider can be off inside an
		// enabled module, leaving the page with nothing to show.
		expect(route?.meta?.module).toBe(MCP_MODULE_NAME);
		expect(route?.meta?.moduleFlag).toBe('oauthEnabled');
	});

	it('registers consent as a standalone owner/admin route, outside the app shell', () => {
		// Template 10: the screen someone coming from another app sees has no sidebar or header
		expect(ModuleRoutes.find(({ name }) => name === RouteNames.OAUTH_CONSENT)).toBeUndefined();

		const route = ModuleStandaloneRoutes.find(({ name }) => name === RouteNames.OAUTH_CONSENT);

		// The authorization server redirects to this exact path, so it must not move
		expect(route?.path).toBe('/mcp-oauth-consent');
		expect(route?.meta?.menu).toBeUndefined();
		expect(route?.meta?.guards).toEqual({
			authenticated: true,
			roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
		});
	});
});
