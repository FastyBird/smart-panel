import type { RouteRecordRaw } from 'vue-router';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IStoresManager } from '../../../../common';
import { RouteNames } from '../../auth.constants';
import type { SessionStore } from '../../store';

import authenticatedGuard from './authenticated.guard';

describe('authenticatedGuard', (): void => {
	let mockStoresManager: IStoresManager;

	const mockSessionStore: SessionStore = {
		isSignedIn: vi.fn(),
	} as SessionStore;

	beforeEach((): void => {
		mockStoresManager = {
			getStore: vi.fn().mockReturnValue(mockSessionStore),
		} as unknown as IStoresManager;
	});

	it('should allow navigation if the user is signed in', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(true);

		const route = { path: 'general', name: 'general', meta: { guards: ['authenticated'] } };

		expect(authenticatedGuard(mockStoresManager, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should redirect to the sign-in route if user is not signed in and the route requires authentication', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(false);

		const route = { path: 'general', name: 'general', meta: { guards: ['authenticated'] } };

		const result = authenticatedGuard(mockStoresManager, route as unknown as RouteRecordRaw);

		expect(result).toEqual({ name: RouteNames.SIGN_IN });
	});

	it('should allow navigation if the user is not signed in but the route does not have an authenticated guard', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(false);

		const route = { path: 'general', name: 'general', meta: { guards: [] } };

		expect(authenticatedGuard(mockStoresManager, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should allow navigation if the guards field is missing', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(false);

		const route = { meta: {} } as RouteRecordRaw;

		expect(authenticatedGuard(mockStoresManager, route)).toBe(true);
	});
});
