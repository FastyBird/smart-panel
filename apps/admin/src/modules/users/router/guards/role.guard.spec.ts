import type { RouteRecordRaw } from 'vue-router';

import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IAppUser } from '../../../../app.types';
import { UsersUserRole } from '../../../../openapi';

import roleGuard from './role.guard';

describe('roleGuard', (): void => {
	it('should allow access when no guards are defined', (): void => {
		const route = { path: '/route-path', meta: {} };

		expect(roleGuard(undefined, route as unknown as RouteRecordRaw)).toBe(true);
		expect(roleGuard({ id: uuid(), username: 'johndoe', role: UsersUserRole.admin }, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should allow access when no role guard is set', (): void => {
		const route = { path: '/route-path', meta: { guards: {} } };

		expect(roleGuard(undefined, route as unknown as RouteRecordRaw)).toBe(true);
		expect(roleGuard({ id: uuid(), username: 'johndoe', role: UsersUserRole.admin }, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should allow access when the user has the required role', (): void => {
		const user: IAppUser = { id: uuid(), username: 'johndoe', role: UsersUserRole.admin };
		const route = { meta: { guards: { roles: [UsersUserRole.admin, UsersUserRole.owner] } } };

		expect(roleGuard(user, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should redirect when the user does not have the required role', (): void => {
		const user: IAppUser = { id: uuid(), username: 'johndoe', role: UsersUserRole.user };
		const route = { meta: { guards: { roles: [UsersUserRole.admin, UsersUserRole.owner] } } };

		expect(roleGuard(user, route as unknown as RouteRecordRaw)).toEqual({ name: AppRouteNames.ROOT });
	});

	it('should redirect when the user is undefined (unauthenticated)', (): void => {
		const route = { meta: { guards: { roles: [UsersUserRole.admin, UsersUserRole.owner] } } };

		expect(roleGuard(undefined, route as unknown as RouteRecordRaw)).toEqual({ name: AppRouteNames.ROOT });
	});

	it('should allow access when role guard exists but is empty', (): void => {
		const route = { meta: { guards: { roles: [] } } };

		expect(roleGuard(undefined, route as unknown as RouteRecordRaw)).toBe(true);
		expect(roleGuard({ id: uuid(), username: 'johndoe', role: UsersUserRole.admin }, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should handle malformed guards data gracefully', (): void => {
		const user: IAppUser = { id: uuid(), username: 'johndoe', role: UsersUserRole.admin };

		expect(roleGuard(user, { meta: { guards: null } } as unknown as RouteRecordRaw)).toBe(true);
		expect(roleGuard(user, { meta: { guards: 'invalid' } } as unknown as RouteRecordRaw)).toBe(true);

		expect(roleGuard(user, { meta: { guards: { someKey: true } } } as unknown as RouteRecordRaw)).toBe(true);
	});
});
