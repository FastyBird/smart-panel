import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemApiException, SystemValidationException } from '../system.exceptions';

import { useSystemInfo } from './system-info.store';
import type { ISystemInfoSetActionPayload } from './system-info.store.types';

const mockSystemInfoRes = {
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

const mockSystemInfo = {
	cpuLoad: 15.3,
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
			rxBytes: 123456789,
			txBytes: 98765432,
		},
	],
	defaultNetwork: {
		interface: 'eth0',
		ip4: '192.168.0.1',
		ip6: 'fe80::134a:1e43:abc5:d413',
		mac: 'xx:xx:xx:xx:xx:xx',
	},
	display: {
		resolutionX: 1920,
		resolutionY: 1080,
		currentResX: 1280,
		currentResY: 720,
	},
};

const backendClient = {
	GET: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('SystemInfo Store', () => {
	let store: ReturnType<typeof useSystemInfo>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useSystemInfo();

		vi.clearAllMocks();
	});

	it('should set config audio data successfully', () => {
		const result = store.set({ data: mockSystemInfo });

		expect(result).toEqual(mockSystemInfo);
		expect(store.data).toEqual(mockSystemInfo);
	});

	it('should throw validation error if set config audio with invalid data', () => {
		expect(() => store.set({ data: { ...mockSystemInfo, cpuLoad: 'invalid' } } as unknown as ISystemInfoSetActionPayload)).toThrow(
			SystemValidationException
		);
	});

	it('should fetch config audio successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockSystemInfoRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockSystemInfo);
		expect(store.data).toEqual(mockSystemInfo);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(SystemApiException);
	});
});
