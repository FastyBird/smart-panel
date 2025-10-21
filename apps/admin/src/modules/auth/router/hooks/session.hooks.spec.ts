import { type ConsolaInstance } from 'consola';
import { jwtDecode } from 'jwt-decode';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as Sentry from '@sentry/vue';

import type { IStoresManager } from '../../../../common';
import type { SessionStore } from '../../store/session.store.types';

import sessionHook from './session.hook';

vi.mock('jwt-decode', () => ({
	jwtDecode: vi.fn(),
}));

vi.mock('@sentry/vue', () => ({
	captureException: vi.fn(),
}));

describe('sessionHook', (): void => {
	let mockStoresManager: IStoresManager;
	let mockLogger: ConsolaInstance;

	const mockSessionStore: SessionStore = {
		initialize: vi.fn().mockResolvedValue(true),
		accessToken: vi.fn().mockReturnValue(null),
		refreshToken: vi.fn().mockReturnValue(null),
		clear: vi.fn(),
		refresh: vi.fn(),
		get: vi.fn(),
		profile: null,
	} as SessionStore;

	let isProd: boolean | undefined;

	beforeEach((): void => {
		vi.clearAllMocks();

		mockStoresManager = {
			getStore: vi.fn().mockReturnValue(mockSessionStore),
		} as unknown as IStoresManager;

		mockLogger = {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		} as unknown as ConsolaInstance;

		// Store original env value
		isProd = import.meta.env.PROD;
	});

	afterEach((): void => {
		// Restore original env value
		import.meta.env.PROD = isProd || false;

		vi.clearAllMocks();
	});

	it('should call sessionStore.initialize()', async (): Promise<void> => {
		await sessionHook(mockStoresManager, mockLogger);

		expect(mockSessionStore.initialize).toHaveBeenCalled();
	});

	it('should clear session and return undefined if refresh token is expired', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue('valid_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('expired_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(
			(token) =>
				token === 'expired_refresh_token'
					? { exp: Math.floor(Date.now() / 1000) - 1000 } // Expired
					: { exp: Math.floor(Date.now() / 1000) + 1000 } // Valid
		);

		expect(await sessionHook(mockStoresManager, mockLogger)).toBeUndefined();

		expect(mockSessionStore.clear).toHaveBeenCalled();
	});

	it('should refresh session if access token is expired', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue('expired_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(
			(token) =>
				token === 'expired_access_token'
					? { exp: Math.floor(Date.now() / 1000) - 1000 } // Expired
					: { exp: Math.floor(Date.now() / 1000) + 1000 } // Valid
		);

		(mockSessionStore.refresh as Mock).mockResolvedValue(true);

		await sessionHook(mockStoresManager, mockLogger);

		expect(mockSessionStore.refresh).toHaveBeenCalled();
	});

	it('should clear session and return undefined if session refresh fails', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue('expired_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');
		(mockSessionStore.refresh as Mock).mockResolvedValue(false);

		vi.mocked(jwtDecode).mockImplementation(() => ({ exp: Math.floor(Date.now() / 1000) - 1000 }));

		expect(await sessionHook(mockStoresManager, mockLogger)).toBeUndefined();

		expect(mockSessionStore.clear).toHaveBeenCalled();
	});

	it('should fetch profile if not loaded', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue('valid_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(() => ({ exp: Math.floor(Date.now() / 1000) + 1000 }));

		mockSessionStore.profile = null;

		(mockSessionStore.get as Mock).mockResolvedValue(true);

		await sessionHook(mockStoresManager, mockLogger);

		expect(mockSessionStore.get).toHaveBeenCalled();
	});

	it('should clear session and return undefined if fetching profile fails', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue('valid_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(() => ({ exp: Math.floor(Date.now() / 1000) + 1000 }));

		mockSessionStore.profile = null;

		(mockSessionStore.get as Mock).mockResolvedValue(false);

		expect(await sessionHook(mockStoresManager, mockLogger)).toBeUndefined();

		expect(mockSessionStore.clear).toHaveBeenCalled();
	});

	it('should refresh session if only refresh token is available', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue(null);
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(() => ({ exp: Math.floor(Date.now() / 1000) + 1000 }));

		(mockSessionStore.refresh as Mock).mockResolvedValue(true);

		await sessionHook(mockStoresManager, mockLogger);

		expect(mockSessionStore.refresh).toHaveBeenCalled();
	});

	it('should clear session if both tokens are missing', async (): Promise<void> => {
		(mockSessionStore.accessToken as Mock).mockReturnValue(null);
		(mockSessionStore.refreshToken as Mock).mockReturnValue(null);

		vi.mocked(jwtDecode).mockImplementation(() => ({ exp: Math.floor(Date.now() / 1000) + 1000 }));

		await sessionHook(mockStoresManager, mockLogger);

		expect(mockSessionStore.clear).toHaveBeenCalled();
	});

	it('should capture exceptions in Sentry when in production mode', async (): Promise<void> => {
		import.meta.env.PROD = true;

		(mockSessionStore.accessToken as Mock).mockReturnValue('expired_access_token');
		(mockSessionStore.refreshToken as Mock).mockReturnValue('valid_refresh_token');

		vi.mocked(jwtDecode).mockImplementation(
			(token) =>
				token === 'expired_access_token'
					? { exp: Math.floor(Date.now() / 1000) - 1000 } // Expired
					: { exp: Math.floor(Date.now() / 1000) + 1000 } // Valid
		);

		(mockSessionStore.refresh as Mock).mockRejectedValue(new Error('Refresh failed'));

		expect(await sessionHook(mockStoresManager, mockLogger)).toBeUndefined();
		expect(mockSessionStore.clear).toHaveBeenCalled();

		expect(Sentry.captureException).toHaveBeenCalledWith(new Error('Refresh failed'));
	});
});
