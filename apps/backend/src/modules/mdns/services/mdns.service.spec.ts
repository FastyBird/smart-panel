import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { MDNS_DEFAULT_SERVICE_NAME, MDNS_DEFAULT_SERVICE_TYPE } from '../mdns.constants';

import { MdnsService } from './mdns.service';

// Create mock functions at the top level, before jest.mock
const mockPublish = jest.fn();
const mockUnpublishAll = jest.fn();
const mockDestroy = jest.fn();
const mockBonjourConstructor = jest.fn();

// Mock bonjour-service module
jest.mock('bonjour-service', () => {
	// Return a factory that returns our mocks
	return {
		__esModule: true,
		Bonjour: function () {
			mockBonjourConstructor();

			return {
				publish: mockPublish,
				unpublishAll: mockUnpublishAll,
				destroy: mockDestroy,
			};
		},
		Service: jest.fn(),
	};
});

describe('MdnsService', () => {
	let service: MdnsService;
	let configService: NestConfigService;

	beforeEach(async () => {
		// Reset all mocks before each test
		mockPublish.mockReset();
		mockUnpublishAll.mockReset();
		mockDestroy.mockReset();
		mockBonjourConstructor.mockReset();

		// Set up mock service object returned by publish
		const mockService = {
			name: MDNS_DEFAULT_SERVICE_NAME,
			type: MDNS_DEFAULT_SERVICE_TYPE,
			port: 3000,
			published: true,
		};

		mockPublish.mockReturnValue(mockService);
		mockUnpublishAll.mockImplementation((callback?: () => void) => {
			if (callback) callback();
		});
		mockDestroy.mockReturnValue(undefined);

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
		jest.restoreAllMocks();
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
		it('should advertise service successfully', () => {
			const port = 3000;

			service.advertise(port);

			expect(mockBonjourConstructor).toHaveBeenCalled();
			expect(mockPublish).toHaveBeenCalledWith(
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
			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should not advertise when mDNS is disabled', () => {
			jest.spyOn(service, 'isEnabled').mockReturnValue(false);

			service.advertise(3000);

			expect(mockPublish).not.toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should not advertise twice', () => {
			service.advertise(3000);
			service.advertise(3000);

			expect(mockPublish).toHaveBeenCalledTimes(1);
		});

		it('should handle advertisement errors gracefully', () => {
			mockPublish.mockImplementationOnce(() => {
				throw new Error('Network error');
			});

			// Should not throw
			expect(() => service.advertise(3000)).not.toThrow();

			expect(service.isCurrentlyAdvertising()).toBe(false);
		});
	});

	describe('stopAdvertising', () => {
		it('should stop advertising and clean up resources', () => {
			// First start advertising
			service.advertise(3000);

			expect(service.isCurrentlyAdvertising()).toBe(true);

			// Then stop
			service.stopAdvertising();

			expect(mockUnpublishAll).toHaveBeenCalled();
			expect(mockDestroy).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should do nothing if not currently advertising', () => {
			service.stopAdvertising();

			expect(mockUnpublishAll).not.toHaveBeenCalled();
			expect(mockDestroy).not.toHaveBeenCalled();
		});

		it('should handle stop errors gracefully', () => {
			service.advertise(3000);

			mockUnpublishAll.mockImplementationOnce(() => {
				throw new Error('Stop error');
			});

			// Should not throw
			expect(() => service.stopAdvertising()).not.toThrow();
		});
	});

	describe('getServiceInfo', () => {
		it('should return service info when advertising', () => {
			service.advertise(3000);

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

		it('should return true after successful advertisement', () => {
			service.advertise(3000);

			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should return false after stopping advertisement', () => {
			service.advertise(3000);
			service.stopAdvertising();

			expect(service.isCurrentlyAdvertising()).toBe(false);
		});
	});

	describe('onApplicationShutdown', () => {
		it('should stop advertising on application shutdown', () => {
			service.advertise(3000);

			service.onApplicationShutdown('SIGTERM');

			expect(mockUnpublishAll).toHaveBeenCalled();
			expect(mockDestroy).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should handle shutdown without advertising', () => {
			// Should not throw
			expect(() => service.onApplicationShutdown('SIGTERM')).not.toThrow();
		});
	});
});
