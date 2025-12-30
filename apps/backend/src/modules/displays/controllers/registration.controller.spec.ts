/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import type { Request } from 'express';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DisplayRole, HomeMode } from '../displays.constants';
import { DisplaysRegistrationException } from '../displays.exceptions';
import { DisplayEntity } from '../entities/displays.entity';
import { RegistrationGuard } from '../guards/registration.guard';
import { PermitJoinService } from '../services/permit-join.service';
import { RegistrationService } from '../services/registration.service';

import { RegistrationController } from './registration.controller';

describe('RegistrationController', () => {
	let controller: RegistrationController;
	let service: RegistrationService;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
		role: DisplayRole.ROOM,
		version: '1.0.0',
		build: '42',
		screenWidth: 1920,
		screenHeight: 1080,
		pixelRatio: 1.5,
		unitSize: 8,
		rows: 12,
		cols: 24,
		darkMode: false,
		brightness: 100,
		screenLockDuration: 30,
		screenSaver: true,
		audioOutputSupported: false,
		audioInputSupported: false,
		speaker: false,
		speakerVolume: 50,
		microphone: false,
		microphoneVolume: 50,
		registeredFromIp: null,
		currentIpAddress: null,
		online: false,
		spaceId: null,
		space: null,
		homeMode: HomeMode.AUTO_SPACE,
		homePageId: null,
		homePage: null,
		status: ConnectionState.UNKNOWN,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockToken = 'mock-jwt-token-for-display';

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [RegistrationController],
			providers: [
				{
					provide: RegistrationService,
					useValue: {
						registerDisplay: jest.fn(),
					},
				},
				{
					provide: PermitJoinService,
					useValue: {
						isPermitJoinActive: jest.fn().mockReturnValue(true),
						getRemainingTime: jest.fn().mockReturnValue(null),
						getDeploymentMode: jest.fn().mockReturnValue('combined'),
					},
				},
			],
		})
			.overrideGuard(RegistrationGuard)
			.useValue({
				canActivate: jest.fn().mockReturnValue(true),
			})
			.compile();

		controller = module.get<RegistrationController>(RegistrationController);
		service = module.get<RegistrationService>(RegistrationService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('register', () => {
		it('should register a display with FastyBird Smart Panel user agent', async () => {
			const registerDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
				build: '42',
				screen_width: 1920,
				screen_height: 1080,
			};

			jest.spyOn(service, 'registerDisplay').mockResolvedValue({
				display: toInstance(DisplayEntity, mockDisplay),
				accessToken: mockToken,
			});

			const mockRequest = {
				headers: {},
				socket: { remoteAddress: '127.0.0.1' },
			} as unknown as Request;
			const result = await controller.register(mockRequest, 'FastyBird Smart Panel/1.0.0', { data: registerDto });

			expect(result.data.display).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(result.data.accessToken).toBe(mockToken);
			expect(service.registerDisplay).toHaveBeenCalledWith(registerDto, 'FastyBird Smart Panel/1.0.0', '127.0.0.1');
		});

		it('should register a display with FastyBird-Display user agent', async () => {
			const registerDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
			};

			jest.spyOn(service, 'registerDisplay').mockResolvedValue({
				display: toInstance(DisplayEntity, mockDisplay),
				accessToken: mockToken,
			});

			const mockRequest = {
				headers: {},
				socket: { remoteAddress: '127.0.0.1' },
			} as unknown as Request;
			const result = await controller.register(mockRequest, 'FastyBird-Display/1.0', { data: registerDto });

			expect(result.data).toBeDefined();
			expect(service.registerDisplay).toHaveBeenCalledWith(registerDto, 'FastyBird-Display/1.0', '127.0.0.1');
		});

		it('should throw DisplaysRegistrationException for invalid user agent', async () => {
			const registerDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
			};

			const mockRequest = {
				headers: {},
				socket: { remoteAddress: '127.0.0.1' },
			} as unknown as Request;
			await expect(controller.register(mockRequest, 'InvalidBrowser/1.0', { data: registerDto })).rejects.toThrow(
				DisplaysRegistrationException,
			);

			expect(service.registerDisplay).not.toHaveBeenCalled();
		});

		it('should throw DisplaysRegistrationException for missing user agent', async () => {
			const registerDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
			};

			const mockRequest = {
				headers: {},
				socket: { remoteAddress: '127.0.0.1' },
			} as unknown as Request;
			await expect(
				controller.register(mockRequest, undefined as unknown as string, { data: registerDto }),
			).rejects.toThrow(DisplaysRegistrationException);

			expect(service.registerDisplay).not.toHaveBeenCalled();
		});

		it('should throw DisplaysRegistrationException for empty user agent', async () => {
			const registerDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
			};

			const mockRequest = {
				headers: {},
				socket: { remoteAddress: '127.0.0.1' },
			} as unknown as Request;
			await expect(controller.register(mockRequest, '', { data: registerDto })).rejects.toThrow(
				DisplaysRegistrationException,
			);

			expect(service.registerDisplay).not.toHaveBeenCalled();
		});
	});
});
