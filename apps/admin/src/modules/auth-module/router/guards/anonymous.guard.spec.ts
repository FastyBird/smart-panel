import type { RouteRecordRaw } from 'vue-router';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IStoresManager } from '../../../../common';
import type { SessionStore } from '../../store';

import anonymousGuard from './anonymous.guard';

describe('anonymousGuard', (): void => {
	let mockStoresManager: IStoresManager;

	const mockSessionStore: SessionStore = {
		isSignedIn: vi.fn(),
	} as SessionStore;

	beforeEach((): void => {
		mockStoresManager = {
			getStore: vi.fn().mockReturnValue(mockSessionStore),
		} as unknown as IStoresManager;
	});

	it('should allow navigation if user is not signed in', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(false);

		const route = { path: 'general', name: 'general', meta: { guards: ['anonymous'] } };

		expect(anonymousGuard(mockStoresManager, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should redirect to the root route if user is signed in and route has an anonymous guard', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(true);

		const route = { path: 'general', name: 'general', meta: { guards: ['anonymous'] } };

		const result = anonymousGuard(mockStoresManager, route as unknown as RouteRecordRaw);

		expect(result).toEqual({ name: AppRouteNames.ROOT });
	});

	it('should allow navigation if user is signed in but route does not have an anonymous guard', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(true);

		const route = { path: 'general', name: 'general', meta: { guards: [] } };

		expect(anonymousGuard(mockStoresManager, route as unknown as RouteRecordRaw)).toBe(true);
	});

	it('should allow navigation if the guards field is missing', (): void => {
		(mockSessionStore.isSignedIn as Mock).mockReturnValue(true);

		const route = { meta: {} } as RouteRecordRaw;

		expect(anonymousGuard(mockStoresManager, route)).toBe(true);
	});
});
