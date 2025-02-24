import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { components } from '../../../openapi';

import {
	DisplayInfoEntity,
	MemoryInfoEntity,
	NetworkStatsEntity,
	OperatingSystemInfoEntity,
	StorageInfoEntity,
	SystemInfoEntity,
	TemperatureInfoEntity,
	ThrottleStatusEntity,
} from './system.entity';

type MemoryInfo = components['schemas']['SystemMemoryInfo'];
type StorageInfo = components['schemas']['SystemStorageInfo'];
type TemperatureInfo = components['schemas']['SystemTemperatureInfo'];
type OperatingSystemInfo = components['schemas']['SystemOperatingSystemInfo'];
type DisplayInfo = components['schemas']['SystemDisplayInfo'];
type NetworkStats = components['schemas']['SystemNetworkStats'];
type SystemInfo = components['schemas']['SystemSystemInfo'];
type ThrottleStatus = components['schemas']['SystemThrottleStatus'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('System module entity and OpenAPI Model Synchronization', () => {
	const validateEntityAgainstModel = <T extends object, U extends object>(entity: T, model: U) => {
		// Convert model keys from snake_case to camelCase
		const modelKeys = Object.keys(model).map((attribute) => attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()));

		// Check that all keys in the model (converted to camelCase) exist in the entity
		modelKeys.forEach((key) => {
			expect(entity).toHaveProperty(key);
		});

		// Convert entity keys to snake_case and compare against the model keys
		const entityKeys = Object.keys(entity).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(model);
		entityKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('MemoryInfoEntity matches SystemMemoryInfo', () => {
		const openApiModel: MemoryInfo = {
			total: 8388608000,
			used: 4200000000,
			free: 4188608000,
		};

		const entityInstance = plainToInstance(MemoryInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('StorageInfoEntity matches SystemStorageInfo', () => {
		const openApiModel: StorageInfo = {
			fs: '/dev/mmcblk0p1',
			used: 15000000000,
			size: 32000000000,
			available: 17000000000,
		};

		const entityInstance = plainToInstance(StorageInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('TemperatureInfoEntity matches SystemTemperatureInfo', () => {
		const openApiModel: TemperatureInfo = {
			cpu: 55,
			gpu: 60,
		};

		const entityInstance = plainToInstance(TemperatureInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('OperatingSystemInfoEntity matches SystemOperatingSystemInfo', () => {
		const openApiModel: OperatingSystemInfo = {
			platform: 'linux',
			distro: 'Debian',
			release: '11 (bullseye)',
			uptime: 36000,
		};

		const entityInstance = plainToInstance(OperatingSystemInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayInfoEntity matches SystemDisplayInfo', () => {
		const openApiModel: DisplayInfo = {
			resolution_x: 1920,
			resolution_y: 1080,
			current_res_x: 1280,
			current_res_y: 720,
		};

		const entityInstance = plainToInstance(DisplayInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('NetworkStatsEntity matches SystemNetworkStats', () => {
		const openApiModel: NetworkStats = {
			interface: 'eth0',
			rx_bytes: 123456789,
			tx_bytes: 98765432,
		};

		const entityInstance = plainToInstance(NetworkStatsEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('SystemInfoEntity matches SystemSystemInfo', () => {
		const openApiModel: SystemInfo = {
			cpu_load: 15.3,
			memory: {
				total: 8388608000,
				used: 4200000000,
				free: 4188608000,
			},
			storage: [
				{
					fs: '/dev/mmcblk0p1',
					used: 15000000000,
					size: 32000000000,
					available: 17000000000,
				},
			],
			temperature: {
				cpu: 55,
				gpu: null,
			},
			os: {
				platform: 'linux',
				distro: 'Debian',
				release: '11 (bullseye)',
				uptime: 36000,
			},
			network: [
				{
					interface: 'eth0',
					rx_bytes: 123456789,
					tx_bytes: 98765432,
				},
			],
			default_network: {
				interface: 'eth0',
				ip4: '192.168.0.1',
				ip6: 'fe80::134a:1e43:abc5:d413',
				mac: 'xx:xx:xx:xx:xx:xx',
			},
			display: {
				resolution_x: 1920,
				resolution_y: 1080,
				current_res_x: 1280,
				current_res_y: 720,
			},
		};

		const entityInstance = plainToInstance(SystemInfoEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ThrottleStatusEntity matches SystemThrottleStatus', () => {
		const openApiModel: ThrottleStatus = {
			undervoltage: false,
			frequency_capping: false,
			throttling: false,
			soft_temp_limit: false,
		};

		const entityInstance = plainToInstance(ThrottleStatusEntity, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateEntityAgainstModel(entityInstance, openApiModel);

		const errors = validateSync(entityInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
