import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationKind, NotificationSeverity } from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ACCESS_TOKEN_TYPE, AUTH_MODULE_NAME } from '../auth.constants';
import { AuthException, AuthNotFoundException } from '../auth.exceptions';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AccessTokenEntity, RefreshTokenEntity } from '../entities/auth.entity';
import { CheckModel, LoggedInModel } from '../models/auth.model';

import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

jest.mock('bcrypt', () => ({
	hash: jest.fn(),
	compare: jest.fn(),
}));

describe('AuthService', () => {
	let authService: AuthService;
	let tokensService: TokensService;
	let usersService: UsersService;
	let jwtService: JwtService;
	let notifications: { notify: jest.Mock; resolve: jest.Mock; resolveAll: jest.Mock };

	const mockUser: UserEntity = {
		id: uuid().toString(),
		isHidden: false,
		username: 'testuser',
		password: 'hashedpassword',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		role: UserRole.USER,
		language: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockCacheManager = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{
					provide: UsersService,
					useValue: {
						findByUsername: jest.fn(),
						findByEmail: jest.fn(),
						findOwner: jest.fn(),
						create: jest.fn(),
						getOneOrThrow: jest.fn(),
					},
				},
				{
					provide: TokensService,
					useValue: {
						create: jest.fn(),
					},
				},
				{
					provide: JwtService,
					useValue: {
						sign: jest.fn().mockReturnValue('mocked-jwt-token'),
						decode: jest.fn(),
					},
				},
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
				{
					provide: NotificationsService,
					useValue: {
						notify: jest.fn(),
						resolve: jest.fn(),
						resolveAll: jest.fn(),
					},
				},
			],
		}).compile();

		authService = module.get<AuthService>(AuthService);
		tokensService = module.get<TokensService>(TokensService);
		usersService = module.get<UsersService>(UsersService);
		jwtService = module.get<JwtService>(JwtService);
		notifications = module.get<NotificationsService>(NotificationsService) as unknown as typeof notifications;
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	it('should be defined', () => {
		expect(authService).toBeDefined();
		expect(tokensService).toBeDefined();
		expect(usersService).toBeDefined();
		expect(jwtService).toBeDefined();
	});

	describe('generateToken', () => {
		it('should return a JWT token', () => {
			const user = toInstance(UserEntity, mockUser);

			expect(authService.generateToken(user)).toBe('mocked-jwt-token');
		});
	});

	describe('checkUsername', () => {
		it('should return valid false if username exists', async () => {
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(toInstance(UserEntity, mockUser));

			const result = await authService.checkUsername({ username: 'testuser' });

			expect(result).toEqual(toInstance(CheckModel, { valid: false }));
		});

		it('should return valid true if username does not exist', async () => {
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);

			const result = await authService.checkUsername({ username: 'newUser' });

			expect(result).toEqual(toInstance(CheckModel, { valid: true }));
		});
	});

	describe('checkEmail', () => {
		it('should return valid false if email exists', async () => {
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(toInstance(UserEntity, mockUser));

			const result = await authService.checkEmail({ email: 'test@example.com' });

			expect(result).toEqual(toInstance(CheckModel, { valid: false }));
		});

		it('should return valid true if email does not exist', async () => {
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			const result = await authService.checkEmail({ email: 'new@example.com' });

			expect(result).toEqual(toInstance(CheckModel, { valid: true }));
		});
	});

	describe('getProfile', () => {
		it('should return user profile when user exists', async () => {
			jest.spyOn(usersService, 'getOneOrThrow').mockResolvedValue(toInstance(UserEntity, mockUser));

			const result = await authService.getProfile(mockUser.id);

			expect(result).toEqual(toInstance(UserEntity, mockUser));
		});

		it('should throw exception if user does not exist', async () => {
			const id = uuid().toString();

			jest.spyOn(usersService, 'getOneOrThrow').mockRejectedValue(new AuthNotFoundException('User not found'));

			await expect(authService.getProfile(id)).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('login', () => {
		it('should return a JWT token when login is successful', async () => {
			const loginDto: LoginDto = {
				username: 'testUser',
				password: 'validPassword',
			};

			const mockDate = new Date();

			jest
				.spyOn(usersService, 'findByUsername')
				.mockResolvedValue(toInstance(UserEntity, { ...mockUser, password: await bcrypt.hash('validPassword', 10) }));

			jest
				.spyOn(tokensService, 'create')
				.mockResolvedValue(toInstance(AccessTokenEntity, { hashedToken: 'mocked-jwt-token' }))
				.mockResolvedValue(toInstance(RefreshTokenEntity, { hashedToken: 'mocked-jwt-token' }));

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

			jest.spyOn(jwtService, 'decode').mockReturnValue({ exp: mockDate.getTime() / 1000 });

			const result = await authService.login(loginDto);

			expect(result).toEqual(
				toInstance(LoggedInModel, {
					accessToken: 'mocked-jwt-token',
					refreshToken: 'mocked-jwt-token',
					type: ACCESS_TOKEN_TYPE,
					expiration: mockDate,
				}),
			);
			expect(notifications.notify).not.toHaveBeenCalled();
		});

		it('does not settle until the login-failed notification is persisted, so a later, lower count cannot land after it', async () => {
			const loginDto: LoginDto = {
				username: 'nonExistent',
				password: 'password',
			};

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			let releaseNotify: () => void = () => undefined;
			notifications.notify.mockImplementation(
				() =>
					new Promise((resolve) => {
						releaseNotify = () => resolve(null);
					}),
			);

			let settled = false;
			const attempt = authService.login(loginDto, { ip: '203.0.113.5' }).catch(() => {
				settled = true;
			});

			// Flushes every pending microtask (unlike a fixed number of `await Promise.resolve()`
			// hops), so login()'s own preceding awaits (validateDto, findByUsername, findByEmail)
			// cannot be mistaken for the deferred notify() this test is actually gating.
			const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

			await flush();
			await flush();
			expect(settled).toBe(false);

			releaseNotify();
			await attempt;

			expect(settled).toBe(true);
		});

		it('should throw AuthNotFoundException and report a login-failed event if user does not exist', async () => {
			const loginDto: LoginDto = {
				username: 'nonExistent',
				password: 'password',
			};

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login(loginDto, { ip: '203.0.113.5' })).rejects.toThrow(AuthNotFoundException);

			expect(notifications.notify).toHaveBeenCalledWith({
				source: AUTH_MODULE_NAME,
				kind: NotificationKind.EVENT,
				key: expect.stringMatching(
					/^login-failed:nonExistent:203\.0\.113\.5:\d{4}-\d{2}-\d{2}-\d{2}$/,
				) as unknown as string,
				severity: NotificationSeverity.WARNING,
				title: 'Failed login attempt for "nonExistent"',
				message: 'From 203.0.113.5 · 1 attempt(s) this hour',
				data: { username: 'nonExistent', ip: '203.0.113.5', reason: 'user_not_found' },
			});
		});

		it('should throw AuthNotFoundException and report an "inactive" reason if the user has no password set', async () => {
			const loginDto: LoginDto = {
				username: 'testUser',
				password: 'anyPassword',
			};

			// Built directly rather than through `toInstance`: `password` is `@Expose({ groups:
			// ['internal'] })`, so the default transform (no `groups` option) always strips it to
			// `undefined` - never the explicit `null` this test needs to reach the "inactive" branch.
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue({ ...mockUser, password: null });

			await expect(authService.login(loginDto, { ip: '203.0.113.7' })).rejects.toThrow(AuthNotFoundException);

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					source: AUTH_MODULE_NAME,
					kind: NotificationKind.EVENT,
					severity: NotificationSeverity.WARNING,
					data: { username: 'testUser', ip: '203.0.113.7', reason: 'inactive' },
				}),
			);
		});

		it('should throw AuthNotFoundException and report a "wrong_password" reason if password is incorrect', async () => {
			const loginDto: LoginDto = {
				username: 'testUser',
				password: 'wrongPassword',
			};

			jest
				.spyOn(usersService, 'findByUsername')
				.mockResolvedValue(toInstance(UserEntity, { ...mockUser, password: await bcrypt.hash('validPassword', 10) }));

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

			await expect(authService.login(loginDto, { ip: '203.0.113.9' })).rejects.toThrow(AuthNotFoundException);

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { username: 'testUser', ip: '203.0.113.9', reason: 'wrong_password' },
				}),
			);
		});

		it('falls back to "unknown" as the client address when no context is given', async () => {
			const loginDto: LoginDto = {
				username: 'nonExistent',
				password: 'password',
			};

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login(loginDto)).rejects.toThrow(AuthNotFoundException);

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { username: 'nonExistent', ip: 'unknown', reason: 'user_not_found' },
				}),
			);
		});

		it('truncates a username longer than 64 characters before using it in the key and data', async () => {
			const longUsername = 'x'.repeat(80);
			const loginDto: LoginDto = { username: longUsername, password: 'password' };

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login(loginDto, { ip: '203.0.113.5' })).rejects.toThrow(AuthNotFoundException);

			const truncated = 'x'.repeat(64);

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					key: expect.stringMatching(
						new RegExp(`^login-failed:${truncated}:203\\.0\\.113\\.5:\\d{4}-\\d{2}-\\d{2}-\\d{2}$`),
					) as unknown as string,
					data: { username: truncated, ip: '203.0.113.5', reason: 'user_not_found' },
				}),
			);
		});

		it('aggregates three failures for the same user, ip and hour into one key with counts 1, 2, 3', async () => {
			const loginDto: LoginDto = { username: 'nonExistent', password: 'password' };

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login(loginDto, { ip: '203.0.113.5' })).rejects.toThrow(AuthNotFoundException);
			await expect(authService.login(loginDto, { ip: '203.0.113.5' })).rejects.toThrow(AuthNotFoundException);
			await expect(authService.login(loginDto, { ip: '203.0.113.5' })).rejects.toThrow(AuthNotFoundException);

			expect(notifications.notify).toHaveBeenCalledTimes(3);

			const calls = notifications.notify.mock.calls.map(([input]) => input as { key: string; message: string });

			expect(calls[1].key).toBe(calls[0].key);
			expect(calls[2].key).toBe(calls[0].key);
			expect(calls[0].message).toBe('From 203.0.113.5 · 1 attempt(s) this hour');
			expect(calls[1].message).toBe('From 203.0.113.5 · 2 attempt(s) this hour');
			expect(calls[2].message).toBe('From 203.0.113.5 · 3 attempt(s) this hour');
		});

		it('never grows the failed-login counter map beyond 1000 keys', async () => {
			jest.useFakeTimers().setSystemTime(new Date('2026-09-02T10:15:00.000Z'));

			const counts = (authService as unknown as { failedLoginCounts: Map<string, number> }).failedLoginCounts;

			for (let i = 0; i < 1000; i++) {
				counts.set(`login-failed:user${i}:1.1.1.1:2026-09-02-10`, 1);
			}

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login({ username: 'newUser', password: 'x' }, { ip: '2.2.2.2' })).rejects.toThrow(
				AuthNotFoundException,
			);

			expect(counts.size).toBe(1000);
			expect(counts.has('login-failed:user0:1.1.1.1:2026-09-02-10')).toBe(false);
			expect(counts.has('login-failed:newUser:2.2.2.2:2026-09-02-10')).toBe(true);
		});
	});

	describe('register', () => {
		it('should throw AuthException if owner already exists', async () => {
			const registerDto: RegisterDto = {
				username: 'newUser',
				password: 'securePassword',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(toInstance(UserEntity, mockUser));

			await expect(authService.register(registerDto)).rejects.toThrow(AuthException);
		});

		it('should register a user and return JWT token', async () => {
			const registerDto: RegisterDto = {
				username: 'newUser',
				password: 'securePassword',
			};
			const registeredUser: UserEntity = {
				id: uuid().toString(),
				isHidden: false,
				username: registerDto.username,
				password: registerDto.password,
				email: null,
				role: UserRole.USER,
				language: null,
				firstName: null,
				lastName: null,
				createdAt: new Date(),
				updatedAt: null,
			};

			const mockDate = new Date();

			const hashedPassword = await bcrypt.hash(registerDto.password, 10);

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);

			jest
				.spyOn(tokensService, 'create')
				.mockResolvedValue(toInstance(AccessTokenEntity, { hashedToken: 'mocked-jwt-token' }))
				.mockResolvedValue(toInstance(RefreshTokenEntity, { hashedToken: 'mocked-jwt-token' }));

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);

			jest.spyOn(usersService, 'create').mockResolvedValue(toInstance(UserEntity, registeredUser));

			jest.spyOn(jwtService, 'decode').mockReturnValue({ exp: mockDate.getTime() / 1000 });

			const result = await authService.register(registerDto);

			expect(result).toEqual(toInstance(UserEntity, registeredUser));
		});

		it('should throw AuthException if email is already registered', async () => {
			const registerDto: RegisterDto = {
				username: 'newUser',
				password: 'securePassword',
				email: 'test@example.com',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(toInstance(UserEntity, mockUser));

			await expect(authService.register(registerDto)).rejects.toThrow(AuthException);
		});

		it('should throw AuthException if username is already registered', async () => {
			const registerDto: RegisterDto = {
				username: 'testuser',
				password: 'securePassword',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(toInstance(UserEntity, mockUser));

			await expect(authService.register(registerDto)).rejects.toThrow(AuthException);
		});
	});
});
