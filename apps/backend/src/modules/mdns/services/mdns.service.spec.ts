import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { MDNS_DEFAULT_SERVICE_NAME, MDNS_DEFAULT_SERVICE_TYPE } from '../mdns.constants';

import { MdnsService } from './mdns.service';

// Create mock functions
const mockAdvertise = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();
const mockGetPort = jest.fn();
const mockShutdown = jest.fn();
const mockCreateService = jest.fn();
const mockGetResponder = jest.fn();

// Mock the @homebridge/ciao module before imports
jest.mock('@homebridge/ciao', () => ({
	__esModule: true,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	getResponder: (...args: unknown[]) => mockGetResponder(...args),
	Protocol: {
		TCP: 'tcp',
		UDP: 'udp',
	},
}));

describe('MdnsService', () => {
	let service: MdnsService;
	let configService: NestConfigService;

	beforeEach(async () => {
		// Reset all mocks before each test
		jest.clearAllMocks();

		// Set up mock service
		const mockService = {
			advertise: mockAdvertise.mockResolvedValue(undefined),
			end: mockEnd.mockResolvedValue(undefined),
			on: mockOn,
			getPort: mockGetPort.mockReturnValue(3000),
		};

		// Set up mock responder
		const mockResponder = {
			createService: mockCreateService.mockReturnValue(mockService),
			shutdown: mockShutdown.mockResolvedValue(undefined),
		};

		// Configure getResponder to return our mock
		mockGetResponder.mockReturnValue(mockResponder);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MdnsService,
				{
					provide: NestConfigService,
					useValue: {
						get: jest.fn((key: string) => {
							const config: Record<string, string> = {
								FB_MDNS_ENABLED: 'true',
								FB_MDNS_SERVICE_NAME: MDNS_DEFAULT_SERVICE_NAME,
								FB_MDNS_SERVICE_TYPE: MDNS_DEFAULT_SERVICE_TYPE,
							};

							return config[key];
						}),
					},
				},
			],
		}).compile();

		service = module.get<MdnsService>(MdnsService);
		configService = module.get<NestConfigService>(NestConfigService);

		// Silence logger during tests
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('isEnabled', () => {
		it('should return true when FB_MDNS_ENABLED is true', () => {
			jest.spyOn(configService, 'get').mockReturnValue('true');

			expect(service.isEnabled()).toBe(true);
		});

		it('should return true when FB_MDNS_ENABLED is 1', () => {
			jest.spyOn(configService, 'get').mockReturnValue('1');

			expect(service.isEnabled()).toBe(true);
		});

		it('should return false when FB_MDNS_ENABLED is false', () => {
			jest.spyOn(configService, 'get').mockReturnValue('false');

			expect(service.isEnabled()).toBe(false);
		});

		it('should return false when FB_MDNS_ENABLED is 0', () => {
			jest.spyOn(configService, 'get').mockReturnValue('0');

			expect(service.isEnabled()).toBe(false);
		});

		it('should return true by default when FB_MDNS_ENABLED is not set', () => {
			jest.spyOn(configService, 'get').mockReturnValue(undefined);

			expect(service.isEnabled()).toBe(true);
		});
	});

	describe('getServiceName', () => {
		it('should return configured service name', () => {
			jest.spyOn(configService, 'get').mockReturnValue('Custom Panel Name');

			expect(service.getServiceName()).toBe('Custom Panel Name');
		});

		it('should return default service name when not configured', () => {
			jest.spyOn(configService, 'get').mockReturnValue(undefined);

			expect(service.getServiceName()).toBe(MDNS_DEFAULT_SERVICE_NAME);
		});
	});

	describe('getServiceType', () => {
		it('should return configured service type', () => {
			jest.spyOn(configService, 'get').mockReturnValue('custom-type');

			expect(service.getServiceType()).toBe('custom-type');
		});

		it('should return default service type when not configured', () => {
			jest.spyOn(configService, 'get').mockReturnValue(undefined);

			expect(service.getServiceType()).toBe(MDNS_DEFAULT_SERVICE_TYPE);
		});
	});

	describe('advertise', () => {
		it('should advertise service successfully', async () => {
			const port = 3000;

			await service.advertise(port);

			expect(mockCreateService).toHaveBeenCalledWith(
				expect.objectContaining({
					name: MDNS_DEFAULT_SERVICE_NAME,
					type: MDNS_DEFAULT_SERVICE_TYPE,
					protocol: 'tcp',
					port,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					txt: expect.objectContaining({
						api: '/api/v1',
						secure: 'false',
					}),
				}),
			);
			expect(mockAdvertise).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should not advertise when mDNS is disabled', async () => {
			jest.spyOn(service, 'isEnabled').mockReturnValue(false);

			await service.advertise(3000);

			expect(mockCreateService).not.toHaveBeenCalled();
			expect(mockAdvertise).not.toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should not advertise twice', async () => {
			await service.advertise(3000);
			await service.advertise(3000);

			expect(mockCreateService).toHaveBeenCalledTimes(1);
			expect(mockAdvertise).toHaveBeenCalledTimes(1);
		});

		it('should handle advertisement errors gracefully', async () => {
			mockAdvertise.mockRejectedValueOnce(new Error('Network error'));

			// Should not throw
			await expect(service.advertise(3000)).resolves.not.toThrow();

			expect(service.isCurrentlyAdvertising()).toBe(false);
		});
	});

	describe('stopAdvertising', () => {
		it('should stop advertising and clean up resources', async () => {
			// First start advertising
			await service.advertise(3000);

			expect(service.isCurrentlyAdvertising()).toBe(true);

			// Then stop
			await service.stopAdvertising();

			expect(mockEnd).toHaveBeenCalled();
			expect(mockShutdown).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should do nothing if not currently advertising', async () => {
			await service.stopAdvertising();

			expect(mockEnd).not.toHaveBeenCalled();
			expect(mockShutdown).not.toHaveBeenCalled();
		});

		it('should handle stop errors gracefully', async () => {
			await service.advertise(3000);

			mockEnd.mockRejectedValueOnce(new Error('Stop error'));

			// Should not throw
			await expect(service.stopAdvertising()).resolves.not.toThrow();
		});
	});

	describe('getServiceInfo', () => {
		it('should return service info when advertising', async () => {
			await service.advertise(3000);

			const info = service.getServiceInfo();

			expect(info).not.toBeNull();
			expect(info?.name).toBe(MDNS_DEFAULT_SERVICE_NAME);
			expect(info?.type).toBe(`_${MDNS_DEFAULT_SERVICE_TYPE}._tcp`);
			expect(info?.port).toBe(3000);
			expect(info?.txt).toEqual(
				expect.objectContaining({
					api: '/api/v1',
					secure: 'false',
				}),
			);
		});

		it('should return null when not advertising', () => {
			const info = service.getServiceInfo();

			expect(info).toBeNull();
		});
	});

	describe('isCurrentlyAdvertising', () => {
		it('should return false initially', () => {
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should return true after successful advertisement', async () => {
			await service.advertise(3000);

			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should return false after stopping advertisement', async () => {
			await service.advertise(3000);
			await service.stopAdvertising();

			expect(service.isCurrentlyAdvertising()).toBe(false);
		});
	});

	describe('onApplicationShutdown', () => {
		it('should stop advertising on application shutdown', async () => {
			await service.advertise(3000);

			await service.onApplicationShutdown('SIGTERM');

			expect(mockEnd).toHaveBeenCalled();
			expect(mockShutdown).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should handle shutdown without advertising', async () => {
			// Should not throw
			await expect(service.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();
		});
	});
});
