/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';

import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { DISPLAY_USERNAME } from '../../users/users.constants';
import { CheckResponseDto } from '../dto/check-response.dto';
import { LoggedInResponseDto } from '../dto/logged-in-response.dto';
import { RegisterDto } from '../dto/register.dto';
import { RegisteredDisplayResponseDto } from '../dto/registered-display-response.dto';
import { AuthService } from '../services/auth.service';
import { CryptoService } from '../services/crypto.service';

import { AuthController } from './auth.controller';

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;
	let cryptoService: CryptoService;
	let usersService: UsersService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: {
						login: jest.fn(),
						register: jest.fn(),
						checkUsername: jest.fn(),
						checkEmail: jest.fn(),
						getProfile: jest.fn(),
					},
				},
				{
					provide: CryptoService,
					useValue: {
						generateSecureSecret: jest.fn(),
					},
				},
				{
					provide: UsersService,
					useValue: {
						findByUsername: jest.fn(),
						findOwner: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get<AuthService>(AuthService);
		cryptoService = module.get<CryptoService>(CryptoService);
		usersService = module.get<UsersService>(UsersService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(authService).toBeDefined();
		expect(cryptoService).toBeDefined();
		expect(usersService).toBeDefined();
	});

	describe('login', () => {
		it('should return a valid token', async () => {
			const loginDto = { username: 'testuser', password: 'password' };
			const expectedResponse = plainToInstance(LoggedInResponseDto, { accessToken: 'valid-token' });

			jest.spyOn(authService, 'login').mockResolvedValue(expectedResponse);

			await expect(controller.login(loginDto)).resolves.toEqual(expectedResponse);
			expect(authService.login).toHaveBeenCalledWith(loginDto);
		});
	});

	describe('register', () => {
		it('should register a new user', async () => {
			const registerDto: RegisterDto = { username: 'newuser', password: 'password' };

			jest.spyOn(authService, 'register');

			await expect(controller.register(registerDto)).resolves.toBeUndefined();
			expect(authService.register).toHaveBeenCalledWith(registerDto);
		});
	});

	describe('registerDisplay', () => {
		it('should register a display when no display user exists', async () => {
			const expectedResponse = plainToInstance(RegisteredDisplayResponseDto, { secret: 'secure-password' });

			jest.spyOn(cryptoService, 'generateSecureSecret').mockReturnValue('secure-password');
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
			jest.spyOn(authService, 'register');

			await expect(controller.registerDisplay('FlutterApp')).resolves.toEqual(expectedResponse);
		});

		it('should throw ForbiddenException if User-Agent is missing or incorrect', async () => {
			await expect(controller.registerDisplay('InvalidApp')).rejects.toThrow(ForbiddenException);
			await expect(controller.registerDisplay(undefined as unknown as string)).rejects.toThrow(ForbiddenException);
		});

		it('should throw ForbiddenException if display user already exists', async () => {
			jest.spyOn(usersService, 'findByUsername').mockResolvedValue({ username: DISPLAY_USERNAME } as UserEntity);

			await expect(controller.registerDisplay('FlutterApp')).rejects.toThrow(ForbiddenException);
		});
	});

	describe('checkUsername', () => {
		it('should check username availability', async () => {
			const username = { username: 'testuser' };
			const expectedResponse: CheckResponseDto = { valid: true };

			jest.spyOn(authService, 'checkUsername').mockResolvedValue(expectedResponse);

			await expect(controller.checkUsername(username)).resolves.toEqual(expectedResponse);
			expect(authService.checkUsername).toHaveBeenCalledWith(username);
		});
	});

	describe('checkEmail', () => {
		it('should check email availability', async () => {
			const email = { email: 'test@example.com' };
			const expectedResponse: CheckResponseDto = { valid: true };

			jest.spyOn(authService, 'checkEmail').mockResolvedValue(expectedResponse);

			await expect(controller.checkEmail(email)).resolves.toEqual(expectedResponse);
			expect(authService.checkEmail).toHaveBeenCalledWith(email);
		});
	});

	describe('getProfile', () => {
		it('should return user profile', async () => {
			const user = { id: '123' };
			const requestMock = { user };
			const expectedUser = new UserEntity();
			expectedUser.id = '123';

			jest.spyOn(authService, 'getProfile').mockResolvedValue(expectedUser);

			await expect(controller.getProfile(requestMock as any)).resolves.toEqual(expectedUser);
			expect(authService.getProfile).toHaveBeenCalledWith('123');
		});

		it('should throw ForbiddenException if no user is found', async () => {
			await expect(controller.getProfile({} as any)).rejects.toThrow(ForbiddenException);
			await expect(controller.getProfile({ user: null } as any)).rejects.toThrow(ForbiddenException);
		});
	});
});
