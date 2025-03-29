import { describe, expect, it } from 'vitest';

import { SystemValidationException } from '../system.exceptions';

import type { ISystemInfoRes } from './system-info.store.types';
import { transformSystemInfoResponse } from './system-info.transformers';

const validConfigWeatherResponse: ISystemInfoRes = {
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

describe('System Info Transformers', (): void => {
	describe('transformSystemInfoResponse', (): void => {
		it('should transform a valid system info response', (): void => {
			const result = transformSystemInfoResponse(validConfigWeatherResponse);

			expect(result).toEqual({
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
			});
		});

		it('should throw an error for an invalid system info response', (): void => {
			expect(() => transformSystemInfoResponse({ ...validConfigWeatherResponse, cpu_load: 'not-a-number' } as unknown as ISystemInfoRes)).toThrow(
				SystemValidationException
			);
		});
	});
});
