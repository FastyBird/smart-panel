import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { ManagedServiceManagerService } from '../../extensions/services/managed-service-manager.service';
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
	let managedServiceManager: { isRegistered: jest.Mock; register: jest.Mock };

	const createMockConfig = (overrides?: Partial<MdnsConfigModel>): MdnsConfigModel => {
		const config = new MdnsConfigModel();
		config.type = MDNS_MODULE_NAME;
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
		mockUnpublishAll.mockImplementation((callback?: (error?: Error) => void) => {
			// Simulate async behavior - call callback asynchronously to match real behavior
			if (callback) {
				setImmediate(() => callback());
			}
		});
		mockDestroy.mockReturnValue(undefined);

		const defaultConfig = createMockConfig();
		managedServiceManager = {
			isRegistered: jest.fn().mockReturnValue(false),
			register: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MdnsService,
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn(() => defaultConfig),
					},
				},
				{
					provide: ManagedServiceManagerService,
					useValue: managedServiceManager,
				},
			],
		}).compile();

		service = module.get<MdnsService>(MdnsService);
		configService = module.get<ConfigService>(ConfigService);

		// Silence logger during tests
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	async function startAdvertisement(port: number = 3000): Promise<void> {
		service.setHttpServerReady(port);

		await service.start();
	}

	it('should be defined', () => {
		expect(service).toBeDefined();
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

	describe('start', () => {
		it('should advertise service successfully after the HTTP server is ready', async () => {
			const port = 3000;

			await startAdvertisement(port);

			expect(mockBonjourConstructor).toHaveBeenCalled();
			expect(mockPublish).toHaveBeenCalledWith(
				expect.objectContaining({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					name: expect.stringContaining(MDNS_DEFAULT_SERVICE_NAME),
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

		it('should not advertise twice', async () => {
			await startAdvertisement();
			await service.start();

			expect(mockPublish).toHaveBeenCalledTimes(1);
		});

		it('cleans up a failed publish before a later managed start succeeds', async () => {
			mockPublish.mockImplementationOnce(() => {
				throw new Error('Network error');
			});

			service.setHttpServerReady(3000);
			await expect(service.start()).rejects.toThrow('Network error');

			expect(service.isCurrentlyAdvertising()).toBe(false);
			expect(service.getServiceInfo()).toBeNull();
			expect(service.getState()).toBe('error');
			expect(mockUnpublishAll).toHaveBeenCalledTimes(1);
			expect(mockDestroy).toHaveBeenCalledTimes(1);

			await service.start();

			expect(mockBonjourConstructor).toHaveBeenCalledTimes(2);
			expect(mockPublish).toHaveBeenCalledTimes(2);
			expect(service.getState()).toBe('started');
			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should refuse to advertise before the HTTP server is ready', async () => {
			await expect(service.start()).rejects.toThrow('HTTP server is ready');
		});
	});

	describe('onHttpServerReady', () => {
		it('registers the service after Fastify is listening', () => {
			service.onHttpServerReady(3000);

			expect(managedServiceManager.isRegistered).toHaveBeenCalledWith('module', MDNS_MODULE_NAME, 'advertisement');
			expect(managedServiceManager.register).toHaveBeenCalledWith(service);
		});

		it('does not register the same service twice', () => {
			managedServiceManager.isRegistered.mockReturnValue(true);

			service.onHttpServerReady(3000);

			expect(managedServiceManager.register).not.toHaveBeenCalled();
		});
	});

	describe('stop', () => {
		it('should stop advertising and clean up resources', async () => {
			// First start advertising
			await startAdvertisement();

			expect(service.isCurrentlyAdvertising()).toBe(true);

			// Then stop
			await service.stop();

			expect(mockUnpublishAll).toHaveBeenCalled();
			expect(mockDestroy).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should do nothing if not currently advertising', async () => {
			await service.stop();

			expect(mockUnpublishAll).not.toHaveBeenCalled();
			expect(mockDestroy).not.toHaveBeenCalled();
		});

		it('should handle stop errors gracefully', async () => {
			await startAdvertisement();

			mockUnpublishAll.mockImplementationOnce((callback?: (error?: Error) => void) => {
				if (callback) {
					setImmediate(() => callback(new Error('Stop error')));
				}
			});

			// Should not throw
			await expect(service.stop()).resolves.not.toThrow();
		});

		it('should wait for unpublishAll before calling destroy', async () => {
			let destroyCalled = false;
			let unpublishAllCompleted = false;

			await startAdvertisement();

			mockUnpublishAll.mockImplementationOnce((callback?: (error?: Error) => void) => {
				setTimeout(() => {
					unpublishAllCompleted = true;
					if (callback) callback();
				}, 10);
			});

			mockDestroy.mockImplementationOnce(() => {
				destroyCalled = true;
				expect(unpublishAllCompleted).toBe(true);
			});

			await service.stop();

			expect(destroyCalled).toBe(true);
			expect(unpublishAllCompleted).toBe(true);
		});
	});

	describe('getServiceInfo', () => {
		it('should return service info when advertising', async () => {
			await startAdvertisement();

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
			await startAdvertisement();

			expect(service.isCurrentlyAdvertising()).toBe(true);
		});

		it('should return false after stopping advertisement', async () => {
			await startAdvertisement();
			await service.stop();

			expect(service.isCurrentlyAdvertising()).toBe(false);
		});
	});

	describe('onApplicationShutdown', () => {
		it('should stop advertising on application shutdown', async () => {
			await startAdvertisement();

			await service.onApplicationShutdown('SIGTERM');

			expect(mockUnpublishAll).toHaveBeenCalled();
			expect(mockDestroy).toHaveBeenCalled();
			expect(service.isCurrentlyAdvertising()).toBe(false);
		});

		it('should handle shutdown without advertising', async () => {
			// Should not throw
			await expect(service.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();
		});
	});

	describe('onConfigChanged', () => {
		it('requires a restart when the advertised name changes', async () => {
			await startAdvertisement();
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue(createMockConfig({ serviceName: 'Renamed Panel' }));

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});

		it('does not require a restart for unchanged service identity', async () => {
			await startAdvertisement();

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: false });
		});
	});

	it('reports healthy only while a service record is published', async () => {
		await expect(service.isHealthy()).resolves.toBe(false);
		await startAdvertisement();
		await expect(service.isHealthy()).resolves.toBe(true);
		await service.stop();
		await expect(service.isHealthy()).resolves.toBe(false);
	});
});
