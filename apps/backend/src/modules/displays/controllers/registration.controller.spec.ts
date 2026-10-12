/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import type { FastifyRequest } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { ClientAddressService } from '../../api/services/client-address.service';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { ConnectionState, HomeMode } from '../displays.constants';
import { DisplaysRegistrationException } from '../displays.exceptions';
import { DisplayEntity } from '../entities/displays.entity';
import { RegistrationGuard } from '../guards/registration.guard';
import { PermitJoinService } from '../services/permit-join.service';
import { RegistrationService } from '../services/registration.service';

import { RegistrationController } from './registration.controller';

describe('RegistrationController', () => {
	let controller: RegistrationController;
	let service: RegistrationService;
	let permitJoinService: { isPermitJoinActive: jest.Mock; getRemainingTime: jest.Mock };
	let trustedProxyRegistry: TrustedProxyRegistryService;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
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
		screenPowerOff: false,
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
		numberFormat: null,
		temperatureUnit: null,
		windSpeedUnit: null,
		pressureUnit: null,
		precipitationUnit: null,
		distanceUnit: null,
		weatherLocationId: null,
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
		permitJoinService = {
			isPermitJoinActive: jest.fn().mockReturnValue(true),
			getRemainingTime: jest.fn().mockReturnValue(null),
		};

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
					useValue: permitJoinService,
				},
				TrustedProxyRegistryService,
				ClientAddressService,
			],
		})
			.overrideGuard(RegistrationGuard)
			.useValue({
				canActivate: jest.fn().mockReturnValue(true),
			})
			.compile();

		controller = module.get<RegistrationController>(RegistrationController);
		service = module.get<RegistrationService>(RegistrationService);
		trustedProxyRegistry = module.get<TrustedProxyRegistryService>(TrustedProxyRegistryService);
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
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;
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
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;
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
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;
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
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;
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
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;
			await expect(controller.register(mockRequest, '', { data: registerDto })).rejects.toThrow(
				DisplaysRegistrationException,
			);

			expect(service.registerDisplay).not.toHaveBeenCalled();
		});
	});

	describe('getRegistrationStatus', () => {
		it('reports open for a genuine loopback peer with no forwarded headers, even with permit-join inactive', () => {
			permitJoinService.isPermitJoinActive.mockReturnValue(false);
			const request = {
				headers: {},
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;

			expect(controller.getRegistrationStatus(request).data.open).toBe(true);
		});

		// Critical regression case: an unrecognised reverse proxy bound to
		// loopback (cloudflared, `tailscale serve`, a local nginx) with
		// FB_TRUSTED_PROXIES unset. The socket peer is genuinely 127.0.0.1,
		// but it is untrusted and forwarded X-Forwarded-For, so a real remote
		// client is behind it — `open: true` here would tell that client
		// registration needs no permit-join.
		it('does not report open for a loopback peer that is untrusted and presents X-Forwarded-For', () => {
			permitJoinService.isPermitJoinActive.mockReturnValue(false);
			const request = {
				headers: { 'x-forwarded-for': '203.0.113.9' },
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;

			expect(controller.getRegistrationStatus(request).data.open).toBe(false);
		});

		it('reports open for that same untrusted-forwarded loopback peer once permit-join is active', () => {
			permitJoinService.isPermitJoinActive.mockReturnValue(true);
			const request = {
				headers: { 'x-forwarded-for': '203.0.113.9' },
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;

			expect(controller.getRegistrationStatus(request).data.open).toBe(true);
		});

		it('treats a LAN client forwarded through a trusted loopback proxy as that client, not as local', () => {
			trustedProxyRegistry.register({ id: 'remote-access', addresses: () => ['127.0.0.1'] });
			permitJoinService.isPermitJoinActive.mockReturnValue(false);
			const request = {
				headers: { 'x-forwarded-for': '192.168.1.77' },
				raw: { socket: { remoteAddress: '127.0.0.1' } },
			} as unknown as FastifyRequest;

			expect(controller.getRegistrationStatus(request).data.open).toBe(false);
		});
	});
});
