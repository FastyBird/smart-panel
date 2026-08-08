import { describe, expect, it } from 'vitest';

import { UsersModuleUserRole } from '../../../openapi.constants';

import { ModuleRoutes } from './index';

describe('MCP routes', () => {
	it('restricts client management to owners and administrators', () => {
		expect(ModuleRoutes[0]?.meta?.guards).toEqual({
			authenticated: true,
			roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
		});
	});
});
