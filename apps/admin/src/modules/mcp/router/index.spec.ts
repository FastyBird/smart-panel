import { describe, expect, it } from 'vitest';

import { UsersModuleUserRole } from '../../../openapi.constants';

import { RouteNames } from '../mcp.constants';

import { ModuleRoutes } from './index';

describe('MCP routes', () => {
	it('restricts client management to owners and administrators', () => {
		expect(ModuleRoutes[0]?.meta?.guards).toEqual({
			authenticated: true,
			roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
		});
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
