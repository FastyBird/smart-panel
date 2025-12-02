import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ISystemInfo } from '../store/system-info.store.types';

import { useSystemInfo } from './useSystemInfo';

const mockAudio: ISystemInfo = {
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
	primaryStorage: {
		fs: '/dev/mmcblk0p1',
		used: 15000000000,
		size: 32000000000,
		available: 17000000000,
	},
	temperature: {
		cpu: 55,
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
			rxBytes: 123456789,
			txBytes: 98765432,
		},
	],
	defaultNetwork: {
		interface: 'eth0',
		ip4: '192.168.0.1',
		ip6: 'fe80::134a:1e43:abc5:d413',
		mac: 'xx:xx:xx:xx:xx:xx',
		hostname: 'smart-panel',
	},
	display: {
		resolutionX: 1920,
		resolutionY: 1080,
		currentResX: 1280,
		currentResY: 720,
	},
	process: {
		pid: 86523,
		uptime: 1496,
	},
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useSystemInfo', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'systemInfo',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a system info', () => {
		mockStore.data.value = mockAudio;

		const { systemInfo } = useSystemInfo();

		expect(systemInfo.value).toEqual(mockAudio);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useSystemInfo();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useSystemInfo();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchSystemInfo and triggers store.get', async () => {
		const { fetchSystemInfo } = useSystemInfo();

		await fetchSystemInfo();

		expect(get).toHaveBeenCalled();
	});
});
