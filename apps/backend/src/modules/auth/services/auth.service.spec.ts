import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { v4 as uuid } from 'uuid';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { ACCESS_TOKEN_TYPE } from '../auth.constants';
import { AuthException, AuthNotFoundException } from '../auth.exceptions';
import { CheckResponseDto } from '../dto/check-response.dto';
import { LoggedInResponseDto } from '../dto/logged-in-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AccessTokenEntity, RefreshTokenEntity } from '../entities/auth.entity';

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

	const mockUser: UserEntity = {
		id: uuid().toString(),
		isHidden: false,
		username: 'testuser',
		password: 'hashedpassword',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		role: UserRole.USER,
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
			],
		}).compile();

		authService = module.get<AuthService>(AuthService);
		tokensService = module.get<TokensService>(TokensService);
		usersService = module.get<UsersService>(UsersService);
		jwtService = module.get<JwtService>(JwtService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(authService).toBeDefined();
		expect(tokensService).toBeDefined();
		expect(usersService).toBeDefined();
		expect(jwtService).toBeDefined();
	});

	describe('generateToken', () => {
		it('should return a JWT token', () => {
			const user = plainToInstance(UserEntity, mockUser);

			expect(authService.generateToken(user)).toBe('mocked-jwt-token');
		});
	});

	describe('checkUsername', () => {
		it('should return valid false if username exists', async () => {
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			const result: CheckResponseDto = await authService.checkUsername({ username: 'testuser' });

			expect(result).toEqual({ valid: false });
		});

		it('should return valid true if username does not exist', async () => {
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);

			const result: CheckResponseDto = await authService.checkUsername({ username: 'newUser' });

			expect(result).toEqual({ valid: true });
		});
	});

	describe('checkEmail', () => {
		it('should return valid false if email exists', async () => {
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			const result: CheckResponseDto = await authService.checkEmail({ email: 'test@example.com' });

			expect(result).toEqual({ valid: false });
		});

		it('should return valid true if email does not exist', async () => {
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			const result: CheckResponseDto = await authService.checkEmail({ email: 'new@example.com' });

			expect(result).toEqual({ valid: true });
		});
	});

	describe('getProfile', () => {
		it('should return user profile when user exists', async () => {
			jest.spyOn(usersService, 'getOneOrThrow').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			const result = await authService.getProfile(mockUser.id);

			expect(result).toEqual(plainToInstance(UserEntity, mockUser));
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
				.mockResolvedValue(
					plainToInstance(UserEntity, { ...mockUser, password: await bcrypt.hash('validPassword', 10) }),
				);

			jest
				.spyOn(tokensService, 'create')
				.mockResolvedValue(plainToInstance(AccessTokenEntity, { hashedToken: 'mocked-jwt-token' }))
				.mockResolvedValue(plainToInstance(RefreshTokenEntity, { hashedToken: 'mocked-jwt-token' }));

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

			jest.spyOn(jwtService, 'decode').mockReturnValue({ exp: mockDate.getTime() / 1000 });

			const result = await authService.login(loginDto);

			expect(result).toEqual(
				plainToInstance(LoggedInResponseDto, {
					accessToken: 'mocked-jwt-token',
					refreshToken: 'mocked-jwt-token',
					type: ACCESS_TOKEN_TYPE,
					expiration: mockDate,
				}),
			);
		});

		it('should throw AuthNotFoundException if user does not exist', async () => {
			const loginDto: LoginDto = {
				username: 'nonExistent',
				password: 'password',
			};

			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

			await expect(authService.login(loginDto)).rejects.toThrow(AuthNotFoundException);
		});

		it('should throw AuthNotFoundException if password is incorrect', async () => {
			const loginDto: LoginDto = {
				username: 'testUser',
				password: 'wrongPassword',
			};

			jest
				.spyOn(usersService, 'findByUsername')
				.mockResolvedValue(
					plainToInstance(UserEntity, { ...mockUser, password: await bcrypt.hash('validPassword', 10) }),
				);

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

			await expect(authService.login(loginDto)).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('register', () => {
		it('should throw AuthException if owner already exists', async () => {
			const registerDto: RegisterDto = {
				username: 'newUser',
				password: 'securePassword',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(plainToInstance(UserEntity, mockUser));

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
				.mockResolvedValue(plainToInstance(AccessTokenEntity, { hashedToken: 'mocked-jwt-token' }))
				.mockResolvedValue(plainToInstance(RefreshTokenEntity, { hashedToken: 'mocked-jwt-token' }));

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);

			jest.spyOn(usersService, 'create').mockResolvedValue(plainToInstance(UserEntity, registeredUser));

			jest.spyOn(jwtService, 'decode').mockReturnValue({ exp: mockDate.getTime() / 1000 });

			const result = await authService.register(registerDto);

			expect(result).toBeUndefined();
		});

		it('should throw AuthException if email is already registered', async () => {
			const registerDto: RegisterDto = {
				username: 'newUser',
				password: 'securePassword',
				email: 'test@example.com',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			await expect(authService.register(registerDto)).rejects.toThrow(AuthException);
		});

		it('should throw AuthException if username is already registered', async () => {
			const registerDto: RegisterDto = {
				username: 'testuser',
				password: 'securePassword',
			};

			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			await expect(authService.register(registerDto)).rejects.toThrow(AuthException);
		});
	});
});
