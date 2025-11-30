import { useCookies } from 'vue3-cookies';

import { createPinia, setActivePinia } from 'pinia';

import { jwtDecode } from 'jwt-decode';
import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IUseBackend, getErrorReason, useBackend } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';
import { AuthException } from '../auth.exceptions';

import { useSession } from './session.store';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(),
	};
});

const cookies = {
	get: vi.fn(),
	set: vi.fn(),
	remove: vi.fn(),
};

vi.mock('vue3-cookies', () => ({
	useCookies: vi.fn(() => ({
		cookies,
	})),
}));

vi.mock('jwt-decode', () => ({
	jwtDecode: vi.fn(),
}));

describe('Session Store', (): void => {
	let sessionStore: ReturnType<typeof useSession>;
	let backendMock: IUseBackend;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let cookiesMock: any;

	beforeEach((): void => {
		setActivePinia(createPinia());

		backendMock = useBackend();
		cookiesMock = useCookies().cookies;

		sessionStore = useSession();

		vi.clearAllMocks();
	});

	it('should initialize store with default values', (): void => {
		expect(sessionStore.tokenPair).toBeNull();
		expect(sessionStore.profile).toBeNull();
		expect(sessionStore.semaphore.fetching).toBe(false);
		expect(sessionStore.semaphore.creating).toBe(false);
		expect(sessionStore.semaphore.updating).toBe(false);
	});

	it('should return null when no access token is set', (): void => {
		expect(sessionStore.accessToken()).toBeNull();
	});

	it('should return null when no refresh token is set', (): void => {
		expect(sessionStore.refreshToken()).toBeNull();
	});

	it('should return false when session is not signed in', (): void => {
		expect(sessionStore.isSignedIn()).toBe(false);
	});

	it('should return false when session is not expired', (): void => {
		expect(sessionStore.isExpired()).toBe(false);
	});

	it('should clear session data', (): void => {
		sessionStore.clear();

		expect(sessionStore.tokenPair).toBeNull();
		expect(sessionStore.profile).toBeNull();

		expect(cookiesMock.remove).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE_NAME);
		expect(cookiesMock.remove).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME);
	});

	it('should initialize session if access token exists', async (): Promise<void> => {
		cookiesMock.get.mockImplementation((name: string) => (name === ACCESS_TOKEN_COOKIE_NAME ? 'mockAccessToken' : 'mockRefreshToken'));

		(jwtDecode as Mock).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

		(backendMock.client.GET as Mock).mockResolvedValue({
			data: { data: { id: uuid(), username: 'tester', role: UsersModuleUserRole.user, created_at: '2024-03-01T12:00:00Z' } },
		});

		const result = await sessionStore.initialize();

		expect(result).toBe(true);
		expect(sessionStore.tokenPair).not.toBeNull();
		expect(sessionStore.profile).not.toBeNull();
	});

	it('should throw error when initializing session fails', async (): Promise<void> => {
		cookiesMock.get.mockImplementation((name: string) => (name === ACCESS_TOKEN_COOKIE_NAME ? 'mockAccessToken' : 'mockRefreshToken'));

		(jwtDecode as Mock).mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

		(backendMock.client.GET as Mock).mockResolvedValue({ error: new Error('Failed to initialize session.') });

		await expect(sessionStore.initialize()).rejects.toThrow(AuthException);
	});

	it('should create a session on login', async (): Promise<void> => {
		const payload = { data: { username: 'test', password: 'password' } };

		const userId = uuid();

		(backendMock.client.POST as Mock).mockResolvedValue({
			data: {
				data: {
					access_token: 'mockAccessToken',
					refresh_token: 'mockRefreshToken',
					type: 'Bearer',
					expiration: Math.floor(Date.now() / 1000) + 3600,
				},
			},
		});

		(backendMock.client.GET as Mock).mockResolvedValue({
			data: { data: { id: userId, username: 'tester', role: UsersModuleUserRole.user, created_at: '2024-03-01T12:00:00Z' } },
		});

		const user = await sessionStore.create(payload);

		expect(user).toEqual({
			id: userId,
			draft: false,
			username: 'tester',
			email: null,
			firstName: null,
			lastName: null,
			isHidden: false,
			role: UsersModuleUserRole.user,
			createdAt: new Date('2024-03-01T12:00:00Z'),
			updatedAt: null,
		});

		expect(cookiesMock.set).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE_NAME, 'mockAccessToken', expect.any(String), '/');
		expect(cookiesMock.set).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'mockRefreshToken', expect.any(String), '/');
	});

	it('should throw error when session creation fails', async (): Promise<void> => {
		(backendMock.client.POST as Mock).mockResolvedValue({ data: undefined, error: new Error('Failed to create user session.') });

		(getErrorReason as Mock).mockReturnValue('Failed to create user session.');

		await expect(sessionStore.create({ data: { username: 'test', password: 'wrong-password' } })).rejects.toThrow(AuthException);
	});

	it('should refresh the session when refresh token exists', async (): Promise<void> => {
		cookiesMock.get.mockReturnValue('mockRefreshToken');

		(backendMock.client.POST as Mock).mockResolvedValue({
			data: {
				data: {
					access_token: 'mockNewAccessToken',
					refresh_token: 'mockNewRefreshToken',
					type: 'Bearer',
					expiration: Math.floor(Date.now() / 1000) + 3600,
				},
			},
		});

		const result = await sessionStore.refresh();

		expect(result).toBe(true);

		expect(cookiesMock.set).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE_NAME, 'mockNewAccessToken', expect.any(String), '/');
		expect(cookiesMock.set).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, 'mockNewRefreshToken', expect.any(String), '/');
	});

	it('should fail refresh when no refresh token is available', async (): Promise<void> => {
		cookiesMock.get.mockReturnValue(null);
		await expect(sessionStore.refresh()).resolves.toBe(false);
	});

	it('should throw an error if refreshing session fails', async (): Promise<void> => {
		cookiesMock.get.mockReturnValue('mockRefreshToken');

		(backendMock.client.POST as Mock).mockResolvedValue({ error: new Error('Refresh session failed.') });

		await expect(sessionStore.refresh()).resolves.toBe(false);
	});
});
