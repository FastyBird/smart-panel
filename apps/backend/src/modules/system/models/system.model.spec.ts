import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { components } from '../../../openapi';

import {
	DisplayInfoModel,
	MemoryInfoModel,
	NetworkStatsModel,
	OperatingSystemInfoModel,
	StorageInfoModel,
	SystemInfoModel,
	TemperatureInfoModel,
	ThrottleStatusModel,
} from './system.model';

type MemoryInfo = components['schemas']['SystemModuleMemoryInfo'];
type StorageInfo = components['schemas']['SystemModuleStorageInfo'];
type TemperatureInfo = components['schemas']['SystemModuleTemperatureInfo'];
type OperatingSystemInfo = components['schemas']['SystemModuleOperatingSystemInfo'];
type DisplayInfo = components['schemas']['SystemModuleDisplayInfo'];
type NetworkStats = components['schemas']['SystemModuleNetworkStats'];
type SystemInfo = components['schemas']['SystemModuleSystemInfo'];
type ThrottleStatus = components['schemas']['SystemModuleThrottleStatus'];

const caseRegex = new RegExp('_([a-z0-9])', 'g');

describe('System module model and OpenAPI component synchronization', () => {
	const validateModelAgainstComponent = <T extends object, U extends object>(model: T, component: U) => {
		// Convert component keys from snake_case to camelCase
		const componentKeys = Object.keys(component).map((attribute) =>
			attribute.replaceAll(caseRegex, (g) => g[1].toUpperCase()),
		);

		// Check that all keys in the component (converted to camelCase) exist in the model
		componentKeys.forEach((key) => {
			expect(model).toHaveProperty(key);
		});

		// Convert model keys to snake_case and compare against the component keys
		const modelKeys = Object.keys(model).map((key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));

		const originalModelKeys = Object.keys(component);
		modelKeys.forEach((key) => {
			expect(originalModelKeys).toContain(key);
		});
	};

	test('MemoryInfoModel matches SystemMemoryInfo', () => {
		const openApiModel: MemoryInfo = {
			total: 8388608000,
			used: 4200000000,
			free: 4188608000,
		};

		const modelInstance = plainToInstance(MemoryInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('StorageInfoModel matches SystemStorageInfo', () => {
		const openApiModel: StorageInfo = {
			fs: '/dev/mmcblk0p1',
			used: 15000000000,
			size: 32000000000,
			available: 17000000000,
		};

		const modelInstance = plainToInstance(StorageInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('TemperatureInfoModel matches SystemTemperatureInfo', () => {
		const openApiModel: TemperatureInfo = {
			cpu: 55,
			gpu: 60,
		};

		const modelInstance = plainToInstance(TemperatureInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('OperatingSystemInfoModel matches SystemOperatingSystemInfo', () => {
		const openApiModel: OperatingSystemInfo = {
			platform: 'linux',
			distro: 'Debian',
			release: '11 (bullseye)',
			uptime: 36000,
		};

		const modelInstance = plainToInstance(OperatingSystemInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayInfoModel matches SystemDisplayInfo', () => {
		const openApiModel: DisplayInfo = {
			resolution_x: 1920,
			resolution_y: 1080,
			current_res_x: 1280,
			current_res_y: 720,
		};

		const modelInstance = plainToInstance(DisplayInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('NetworkStatsModel matches SystemNetworkStats', () => {
		const openApiModel: NetworkStats = {
			interface: 'eth0',
			rx_bytes: 123456789,
			tx_bytes: 98765432,
		};

		const modelInstance = plainToInstance(NetworkStatsModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('SystemInfoModel matches SystemSystemInfo', () => {
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

		const modelInstance = plainToInstance(SystemInfoModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ThrottleStatusModel matches SystemThrottleStatus', () => {
		const openApiModel: ThrottleStatus = {
			undervoltage: false,
			frequency_capping: false,
			throttling: false,
			soft_temp_limit: false,
		};

		const modelInstance = plainToInstance(ThrottleStatusModel, openApiModel, {
			excludeExtraneousValues: true,
			enableImplicitConversion: true,
		});

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
