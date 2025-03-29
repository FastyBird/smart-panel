import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as Sentry from '@sentry/vue';

import type { IStoresManager } from '../../../../common';
import type { IUser } from '../../../users';
import type { SessionStore } from '../../store';

import profileHook from './profile.hook';

vi.mock('@sentry/vue', () => ({
	setUser: vi.fn(),
}));

describe('profileHook', (): void => {
	let mockStoresManager: IStoresManager;

	const mockSessionStore: SessionStore = {
		profile: { id: '12345', email: 'test@example.com' } as IUser,
	} as SessionStore;

	let isProd: boolean | undefined;

	beforeEach((): void => {
		mockStoresManager = {
			getStore: vi.fn().mockReturnValue(mockSessionStore),
		} as unknown as IStoresManager;

		// Store original env value
		isProd = import.meta.env.PROD;
	});

	afterEach((): void => {
		// Restore original env value
		import.meta.env.PROD = isProd || false;

		vi.clearAllMocks();
	});

	it('should set the user in Sentry if in production mode and profile is not null', (): void => {
		// Simulate production mode
		import.meta.env.PROD = true;

		expect(profileHook(mockStoresManager)).toBeUndefined();

		expect(Sentry.setUser).toHaveBeenCalledWith({
			id: '12345',
			email: 'test@example.com',
		});
	});

	it('should not set the user in Sentry if the profile is null', (): void => {
		import.meta.env.PROD = true;

		mockSessionStore.profile = null;

		expect(profileHook(mockStoresManager)).toBeUndefined();
		expect(Sentry.setUser).not.toHaveBeenCalled();
	});

	it('should not set the user in Sentry if not in production mode', (): void => {
		import.meta.env.PROD = false;

		expect(profileHook(mockStoresManager)).toBeUndefined();
		expect(Sentry.setUser).not.toHaveBeenCalled();
	});

	it('should set the user email as unknown if email is missing', (): void => {
		import.meta.env.PROD = true;

		mockSessionStore.profile = { id: '67890', email: null } as IUser;

		expect(profileHook(mockStoresManager)).toBeUndefined();

		expect(Sentry.setUser).toHaveBeenCalledWith({
			id: '67890',
			email: 'unknown@user.com',
		});
	});
});
