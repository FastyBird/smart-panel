import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { MDNS_DEFAULT_SERVICE_NAME, MDNS_DEFAULT_SERVICE_TYPE, MDNS_MODULE_NAME } from '../mdns.constants';
import { MdnsConfigModel } from '../models/config.model';

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
	let configService: ConfigService;

	const createMockConfig = (overrides?: Partial<MdnsConfigModel>): MdnsConfigModel => {
		const config = new MdnsConfigModel();
		config.type = MDNS_MODULE_NAME;
		config.enabled = true;
		config.serviceName = MDNS_DEFAULT_SERVICE_NAME;
		config.serviceType = MDNS_DEFAULT_SERVICE_TYPE;
		Object.assign(config, overrides);

		return config;
	};

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

		const defaultConfig = createMockConfig();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MdnsService,
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn(() => defaultConfig),
					},
				},
			],
		}).compile();

		service = module.get<MdnsService>(MdnsService);
		configService = module.get<ConfigService>(ConfigService);

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
		it('should return true when enabled is true', () => {
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(createMockConfig({ enabled: true }));

			expect(service.isEnabled()).toBe(true);
		});

		it('should return false when enabled is false', () => {
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(createMockConfig({ enabled: false }));

			expect(service.isEnabled()).toBe(false);
		});

		it('should return true by default when config is not available', () => {
			jest.spyOn(configService, 'getModuleConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			expect(service.isEnabled()).toBe(true);
		});
	});

	describe('getServiceName', () => {
		it('should return configured service name', () => {
			jest
				.spyOn(configService, 'getModuleConfig')
				.mockReturnValue(createMockConfig({ serviceName: 'Custom Panel Name' }));

			expect(service.getServiceName()).toBe('Custom Panel Name');
		});

		it('should return default service name when config is not available', () => {
			jest.spyOn(configService, 'getModuleConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

			expect(service.getServiceName()).toBe(MDNS_DEFAULT_SERVICE_NAME);
		});
	});

	describe('getServiceType', () => {
		it('should return configured service type', () => {
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(createMockConfig({ serviceType: 'custom-type' }));

			expect(service.getServiceType()).toBe('custom-type');
		});

		it('should return default service type when config is not available', () => {
			jest.spyOn(configService, 'getModuleConfig').mockImplementation(() => {
				throw new Error('Config not found');
			});

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
