/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckUsernameDto } from '../dto/check-username.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import {
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	LoginResponseModel,
	ProfileResponseModel,
} from '../models/auth-response.model';
import { CheckModel, LoggedInModel } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

import { AuthController } from './auth.controller';

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;
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
		usersService = module.get<UsersService>(UsersService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(authService).toBeDefined();
		expect(usersService).toBeDefined();
	});

	describe('login', () => {
		it('should return a valid token', async () => {
			const loginDto: LoginDto = { username: 'testuser', password: 'password' };
			const serviceResponse = toInstance(LoggedInModel, { accessToken: 'valid-token' });
			const expectedResponse = toInstance(LoginResponseModel, { data: serviceResponse });

			jest.spyOn(authService, 'login').mockResolvedValue(serviceResponse);

			await expect(controller.login({ data: loginDto })).resolves.toEqual(expectedResponse);
			expect(authService.login).toHaveBeenCalledWith(loginDto);
		});
	});

	describe('register', () => {
		it('should register a new user', async () => {
			const registerDto: RegisterDto = { username: 'newuser', password: 'password' };

			jest.spyOn(authService, 'register');

			await expect(controller.register({ data: registerDto })).resolves.toBeUndefined();
			expect(authService.register).toHaveBeenCalledWith(registerDto);
		});
	});

	describe('checkUsername', () => {
		it('should check username availability', async () => {
			const username: CheckUsernameDto = { username: 'testuser' };
			const serviceResponse = toInstance(CheckModel, { valid: true });
			const expectedResponse = toInstance(CheckUsernameResponseModel, { data: serviceResponse });

			jest.spyOn(authService, 'checkUsername').mockResolvedValue(serviceResponse);

			await expect(controller.checkUsername({ data: username })).resolves.toEqual(expectedResponse);
			expect(authService.checkUsername).toHaveBeenCalledWith(username);
		});
	});

	describe('checkEmail', () => {
		it('should check email availability', async () => {
			const email: CheckEmailDto = { email: 'test@example.com' };
			const serviceResponse = toInstance(CheckModel, { valid: true });
			const expectedResponse = toInstance(CheckEmailResponseModel, { data: serviceResponse });

			jest.spyOn(authService, 'checkEmail').mockResolvedValue(serviceResponse);

			await expect(controller.checkEmail({ data: email })).resolves.toEqual(expectedResponse);
			expect(authService.checkEmail).toHaveBeenCalledWith(email);
		});
	});

	describe('getProfile', () => {
		it('should return user profile', async () => {
			const auth = { type: 'user', id: '123', role: UserRole.OWNER };
			const requestMock = { auth };
			const expectedUser = new UserEntity();
			expectedUser.id = '123';
			const expectedResponse = toInstance(ProfileResponseModel, { data: expectedUser });

			jest.spyOn(authService, 'getProfile').mockResolvedValue(expectedUser);

			await expect(controller.getProfile(requestMock as any)).resolves.toEqual(expectedResponse);
			expect(authService.getProfile).toHaveBeenCalledWith('123');
		});

		it('should throw ForbiddenException if no user is found', async () => {
			await expect(controller.getProfile({} as any)).rejects.toThrow(ForbiddenException);
			await expect(controller.getProfile({ auth: null } as any)).rejects.toThrow(ForbiddenException);
		});

		it('should throw ForbiddenException if auth type is not user', async () => {
			const auth = { type: 'token', tokenId: '123', ownerType: 'display', ownerId: '456', role: UserRole.USER };
			await expect(controller.getProfile({ auth } as any)).rejects.toThrow(ForbiddenException);
		});
	});
});
