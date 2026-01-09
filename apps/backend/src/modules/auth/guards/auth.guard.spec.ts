/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { TokenOwnerType } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity } from '../entities/auth.entity';
import { TokensService } from '../services/tokens.service';

import { AuthGuard, AuthenticatedRequest, IS_PUBLIC_KEY } from './auth.guard';

jest.mock('../utils/token.utils', () => ({
	hashToken: jest.fn((token) => `hashed-${token}`),
}));

describe('AuthGuard', () => {
	let guard: AuthGuard;
	let jwtService: JwtService;
	let reflector: Reflector;
	let tokensService: TokensService;
	let usersService: UsersService;

	const mockUserId = uuid().toString();
	const mockDisplayId = uuid().toString();
	const mockTokenId = uuid().toString();

	const mockUser: UserEntity = {
		id: mockUserId,
		email: 'test@example.com',
		firstName: 'Test',
		lastName: 'User',
		username: 'testuser',
		role: UserRole.ADMIN,
		isHidden: false,
		password: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockAccessToken = 'valid-access-token';
	const mockDisplayToken = 'valid-display-token';
	const mockLongLiveToken = 'valid-long-live-token';

	// Create mock refresh token
	const mockRefreshTokenEntity = {
		id: uuid().toString(),
		hashedToken: 'hashed-refresh-token',
		revoked: false,
		expiresAt: new Date(Date.now() + 86400000),
		createdAt: new Date(),
		owner: mockUser,
	} as unknown as RefreshTokenEntity;

	// Create mock access token with refreshToken getter that returns the mock refresh token
	const mockAccessTokenEntity = {
		id: uuid().toString(),
		hashedToken: `hashed-${mockAccessToken}`,
		revoked: false,
		expiresAt: new Date(Date.now() + 3600000),
		createdAt: new Date(),
		owner: mockUser,
		get refreshToken() {
			return mockRefreshTokenEntity;
		},
		children: [mockRefreshTokenEntity],
	} as unknown as AccessTokenEntity;

	const mockDisplayLongLiveToken = {
		id: mockTokenId,
		name: 'Display Token',
		description: 'Test display token',
		hashedToken: `hashed-${mockDisplayToken}`,
		revoked: false,
		expiresAt: new Date(Date.now() + 31536000000), // 1 year
		createdAt: new Date(),
		ownerType: TokenOwnerType.DISPLAY,
		ownerId: mockDisplayId,
	} as unknown as LongLiveTokenEntity;

	const mockThirdPartyLongLiveToken = {
		id: uuid().toString(),
		name: 'Third Party Token',
		description: 'Test third party token',
		hashedToken: `hashed-${mockLongLiveToken}`,
		revoked: false,
		expiresAt: new Date(Date.now() + 31536000000),
		createdAt: new Date(),
		ownerType: TokenOwnerType.THIRD_PARTY,
		ownerId: null,
	} as unknown as LongLiveTokenEntity;

	const createMockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext => {
		const request: Partial<AuthenticatedRequest> = {
			headers: headers as unknown as AuthenticatedRequest['headers'],
		};

		return {
			switchToHttp: () => ({
				getRequest: () => request,
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		} as ExecutionContext;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthGuard,
				{
					provide: JwtService,
					useValue: {
						verifyAsync: jest.fn(),
					},
				},
				{
					provide: Reflector,
					useValue: {
						getAllAndOverride: jest.fn(),
					},
				},
				{
					provide: TokensService,
					useValue: {
						findAllByOwner: jest.fn(),
						findByOwnerId: jest.fn(),
						findAll: jest.fn(),
					},
				},
				{
					provide: UsersService,
					useValue: {
						getOneOrThrow: jest.fn(),
						findOne: jest.fn(),
					},
				},
				{
					provide: CACHE_MANAGER,
					useValue: {
						get: jest.fn(),
						set: jest.fn(),
					},
				},
			],
		}).compile();

		guard = module.get<AuthGuard>(AuthGuard);
		jwtService = module.get<JwtService>(JwtService);
		reflector = module.get<Reflector>(Reflector);
		tokensService = module.get<TokensService>(TokensService);
		usersService = module.get<UsersService>(UsersService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	describe('canActivate', () => {
		it('should allow access to public routes', async () => {
			const context = createMockExecutionContext({});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
				context.getHandler(),
				context.getClass(),
			]);
		});

		it('should throw UnauthorizedException when no token provided', async () => {
			const context = createMockExecutionContext({});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException for invalid token', async () => {
			const context = createMockExecutionContext({
				authorization: 'Bearer invalid-token',
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('Invalid token'));

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});
	});

	describe('validateUserAccessToken', () => {
		it('should authenticate user with valid access token', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer ${mockAccessToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUserId });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([mockAccessTokenEntity]);
			jest.spyOn(usersService, 'getOneOrThrow').mockResolvedValue(mockUser);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({ type: 'user', id: mockUser.id, role: mockUser.role });
		});

		it('should throw UnauthorizedException when access token not found', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer unknown-token`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUserId });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when access token is revoked', async () => {
			const revokedToken = {
				...mockAccessTokenEntity,
				revoked: true,
				get refreshToken() {
					return mockRefreshTokenEntity;
				},
			} as unknown as AccessTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockAccessToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUserId });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([revokedToken]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when refresh token is revoked', async () => {
			const revokedRefresh = { ...mockRefreshTokenEntity, revoked: true } as unknown as RefreshTokenEntity;
			const tokenWithRevokedRefresh = {
				...mockAccessTokenEntity,
				get refreshToken() {
					return revokedRefresh;
				},
				children: [revokedRefresh],
			} as unknown as AccessTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockAccessToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUserId });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([tokenWithRevokedRefresh]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when user not found', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer ${mockAccessToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockUserId });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([mockAccessTokenEntity]);
			jest.spyOn(usersService, 'getOneOrThrow').mockRejectedValue(new Error('User not found'));

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});
	});

	describe('validateDisplayToken', () => {
		it('should authenticate display with valid display token', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer ${mockDisplayToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockDisplayId, type: 'display' });
			jest.spyOn(tokensService, 'findByOwnerId').mockResolvedValue([mockDisplayLongLiveToken]);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({
				type: 'token',
				tokenId: mockDisplayLongLiveToken.id,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplayId,
				role: UserRole.USER,
			});
		});

		it('should throw UnauthorizedException when display token not found', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer unknown-display-token`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockDisplayId, type: 'display' });
			jest.spyOn(tokensService, 'findByOwnerId').mockResolvedValue([]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when display token is revoked', async () => {
			const revokedToken = { ...mockDisplayLongLiveToken, revoked: true } as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockDisplayToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockDisplayId, type: 'display' });
			jest.spyOn(tokensService, 'findByOwnerId').mockResolvedValue([revokedToken]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when display token is expired', async () => {
			const expiredToken = {
				...mockDisplayLongLiveToken,
				expiresAt: new Date(Date.now() - 1000),
			} as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockDisplayToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: mockDisplayId, type: 'display' });
			jest.spyOn(tokensService, 'findByOwnerId').mockResolvedValue([expiredToken]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});
	});

	describe('validateLongLiveToken', () => {
		it('should authenticate third-party with valid long-live token', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			// JWT verify returns a payload that doesn't indicate display or user type
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([mockThirdPartyLongLiveToken]);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({
				type: 'token',
				tokenId: mockThirdPartyLongLiveToken.id,
				ownerType: TokenOwnerType.THIRD_PARTY,
				ownerId: null,
				role: UserRole.USER,
			});
		});

		it('should throw UnauthorizedException when long-live token not found', async () => {
			const context = createMockExecutionContext({
				authorization: `Bearer unknown-long-live-token`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when long-live token is revoked', async () => {
			const revokedToken = { ...mockThirdPartyLongLiveToken, revoked: true } as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([revokedToken]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when long-live token is expired', async () => {
			const expiredToken = {
				...mockThirdPartyLongLiveToken,
				expiresAt: new Date(Date.now() - 1000),
			} as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([expiredToken]);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should authenticate user long-live token with owner', async () => {
			const userLongLiveToken = {
				...mockThirdPartyLongLiveToken,
				ownerType: TokenOwnerType.USER,
				ownerId: mockUserId,
			} as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([userLongLiveToken]);
			jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({
				type: 'token',
				tokenId: userLongLiveToken.id,
				ownerType: TokenOwnerType.USER,
				ownerId: mockUserId,
				role: mockUser.role,
			});
		});

		it('should authenticate display long-live token', async () => {
			const displayLongLiveToken = {
				...mockThirdPartyLongLiveToken,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplayId,
			} as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([displayLongLiveToken]);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({
				type: 'token',
				tokenId: displayLongLiveToken.id,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplayId,
				role: UserRole.USER,
			});
		});

		it('should authenticate display token without ownerId', async () => {
			const displayTokenWithoutOwner = {
				...mockThirdPartyLongLiveToken,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: null,
			} as unknown as LongLiveTokenEntity;

			const context = createMockExecutionContext({
				authorization: `Bearer ${mockLongLiveToken}`,
			});
			const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'some-id', type: 'api' });
			jest.spyOn(tokensService, 'findAllByOwner').mockResolvedValue([]);
			jest.spyOn(tokensService, 'findAll').mockResolvedValue([displayTokenWithoutOwner]);

			const result = await guard.canActivate(context);

			expect(result).toBe(true);
			expect(request.auth).toEqual({
				type: 'token',
				tokenId: displayTokenWithoutOwner.id,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: null,
				role: UserRole.USER,
			});
		});
	});

	describe('extractTokenFromHeader', () => {
		it('should return undefined for missing authorization header', async () => {
			const context = createMockExecutionContext({});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});

		it('should return undefined for non-Bearer token', async () => {
			const context = createMockExecutionContext({
				authorization: 'Basic some-token',
			});

			jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

			await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		});
	});
});
