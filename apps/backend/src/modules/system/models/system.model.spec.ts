import { validateSync } from 'class-validator';
import 'reflect-metadata';

import { toInstance } from '../../../common/utils/transform.utils';

import {
	DisplayInfoModel,
	ExtensionAdminModel,
	ExtensionBackendModel,
	LogEntryModel,
	MemoryInfoModel,
	NetworkStatsModel,
	OperatingSystemInfoModel,
	ProcessInfoModel,
	StorageInfoModel,
	SystemHealthModel,
	SystemInfoModel,
	TemperatureInfoModel,
	ThrottleStatusModel,
} from './system.model';

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

	test('MemoryInfoModel matches MemoryInfo', () => {
		const openApiModel = {
			total: 8388608000,
			used: 4200000000,
			free: 4188608000,
		};

		const modelInstance = toInstance(MemoryInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('StorageInfoModel matches StorageInfo', () => {
		const openApiModel = {
			fs: '/dev/mmcblk0p1',
			used: 15000000000,
			size: 32000000000,
			available: 17000000000,
		};

		const modelInstance = toInstance(StorageInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('TemperatureInfoModel matches TemperatureInfo', () => {
		const openApiModel = {
			cpu: 55,
			gpu: 60,
		};

		const modelInstance = toInstance(TemperatureInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('OperatingSystemInfoModel matches OperatingSystemInfo', () => {
		const openApiModel = {
			platform: 'linux',
			distro: 'Debian',
			release: '11 (bullseye)',
			uptime: 36000,
			node: '20.18.1',
			npm: '11.1.0',
			timezone: 'CET+0100',
		};

		const modelInstance = toInstance(OperatingSystemInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('DisplayInfoModel matches DisplayInfo', () => {
		const openApiModel = {
			resolution_x: 1920,
			resolution_y: 1080,
			current_res_x: 1280,
			current_res_y: 720,
		};

		const modelInstance = toInstance(DisplayInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ProcessModel matches ProcessInfo', () => {
		const openApiModel = {
			pid: 86523,
			uptime: 1496,
		};

		const modelInstance = toInstance(ProcessInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('NetworkStatsModel matches NetworkStats', () => {
		const openApiModel = {
			interface: 'eth0',
			rx_bytes: 123456789,
			tx_bytes: 98765432,
		};

		const modelInstance = toInstance(NetworkStatsModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('SystemInfoModel matches SystemInfo', () => {
		const openApiModel = {
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
			primary_storage: {
				fs: '/dev/mmcblk0p1',
				used: 15000000000,
				size: 32000000000,
				available: 17000000000,
			},
			temperature: {
				cpu: 55,
				gpu: null,
			},
			os: {
				platform: 'linux',
				distro: 'Debian',
				release: '11 (bullseye)',
				uptime: 36000,
				node: '20.18.1',
				npm: '11.1.0',
				timezone: 'CET+0100',
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
				hostname: 'smart-panel',
			},
			display: {
				resolution_x: 1920,
				resolution_y: 1080,
				current_res_x: 1280,
				current_res_y: 720,
			},
			process: {
				pid: 86523,
				uptime: 1496,
			},
		};

		const modelInstance = toInstance(SystemInfoModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('SystemHealthModel matches SystemHealth', () => {
		const openApiModel = {
			status: 'ok',
			version: '1.0.0',
		};

		const modelInstance = toInstance(SystemHealthModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ThrottleStatusModel matches ThrottleStatus', () => {
		const openApiModel = {
			undervoltage: false,
			frequency_capping: false,
			throttling: false,
			soft_temp_limit: false,
		};

		const modelInstance = toInstance(ThrottleStatusModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('LogEntryModel matches LogEntry', () => {
		const openApiModel = {
			id: '01K83ZYR44X43H0VP0NPQBM22N',
			ts: '2025-10-21T18:19:28.260Z',
			ingested_at: '2025-10-21T18:19:28.260Z',
			seq: 6,
			source: 'backend',
			level: 2,
			type: 'info',
			tag: 'InstanceLoader',
			message: 'Example log entry',
			args: [],
			user: {},
			context: {},
		};

		const modelInstance = toInstance(LogEntryModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ExtensionAdminModel matches ExtensionAdmin', () => {
		const openApiModel = {
			name: '@fastybird/example-extension-admin',
			kind: 'plugin',
			surface: 'admin',
			display_name: 'Example Admin',
			description: 'Tiny demo admin plugin',
			version: '1.0.0',
			source: 'bundled',
			remote_url: ':baseUrl/system-module/extensions/assets/%40fastybird%2Fexample-extension-admin/admin/index.js',
		};

		const modelInstance = toInstance(ExtensionAdminModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});

	test('ExtensionBackendModel matches ExtensionBackend', () => {
		const openApiModel = {
			name: '@fastybird/example-extension-admin',
			kind: 'plugin',
			surface: 'backend',
			display_name: 'Example Admin',
			description: 'Tiny demo admin plugin',
			version: '1.0.0',
			source: 'bundled',
			route_prefix: 'devices/acme',
		};

		const modelInstance = toInstance(ExtensionBackendModel, openApiModel);

		validateModelAgainstComponent(modelInstance, openApiModel);

		const errors = validateSync(modelInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
		expect(errors).toHaveLength(0);
	});
});
