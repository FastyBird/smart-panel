import { type ZodType, z } from 'zod';

import type { SystemModuleSystemInfoSchema } from '../../../openapi.constants';

type ApiSystemInfo = SystemModuleSystemInfoSchema;

// STORE STATE
// ===========

export const SystemInfoSchema = z.object({
	cpuLoad: z.number(),
	memory: z.object({
		total: z.number(),
		used: z.number(),
		free: z.number(),
	}),
	storage: z.array(
		z.object({
			fs: z.string(),
			used: z.number(),
			size: z.number(),
			available: z.number(),
		})
	),
	primaryStorage: z.object({
		fs: z.string(),
		used: z.number(),
		size: z.number(),
		available: z.number(),
	}),
	temperature: z.object({
		cpu: z.number().nullable().optional(),
		gpu: z.number().nullable().optional(),
	}),
	os: z.object({
		platform: z.string(),
		distro: z.string(),
		release: z.string(),
		uptime: z.number(),
		node: z.string(),
		npm: z.string().nullable(),
		timezone: z.string(),
	}),
	network: z.array(
		z.object({
			interface: z.string(),
			rxBytes: z.number(),
			txBytes: z.number(),
		})
	),
	defaultNetwork: z.object({
		interface: z.string(),
		ip4: z.string(),
		ip6: z.string(),
		mac: z.string(),
		hostname: z.string(),
	}),
	display: z.object({
		resolutionX: z.number(),
		resolutionY: z.number(),
		currentResX: z.number(),
		currentResY: z.number(),
	}),
	process: z.object({
		pid: z.number(),
		uptime: z.number(),
	}),
});

export const SystemInfoStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const SystemInfoOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const SystemInfoSetActionPayloadSchema = z.object({
	data: z.object({
		cpuLoad: z.number(),
		memory: z.object({
			total: z.number(),
			used: z.number(),
			free: z.number(),
		}),
		storage: z.array(
			z.object({
				fs: z.string(),
				used: z.number(),
				size: z.number(),
				available: z.number(),
			})
		),
		primaryStorage: z.object({
			fs: z.string(),
			used: z.number(),
			size: z.number(),
			available: z.number(),
		}),
		temperature: z.object({
			cpu: z.number().nullable().optional(),
			gpu: z.number().nullable().optional(),
		}),
		os: z.object({
			platform: z.string(),
			distro: z.string(),
			release: z.string(),
			uptime: z.number(),
			node: z.string(),
			npm: z.string().nullable(),
			timezone: z.string(),
		}),
		network: z.array(
			z.object({
				interface: z.string(),
				rxBytes: z.number(),
				txBytes: z.number(),
			})
		),
		defaultNetwork: z.object({
			interface: z.string(),
			ip4: z.string(),
			ip6: z.string(),
			mac: z.string(),
			hostname: z.string(),
		}),
		display: z.object({
			resolutionX: z.number(),
			resolutionY: z.number(),
			currentResX: z.number(),
			currentResY: z.number(),
		}),
		process: z.object({
			pid: z.number(),
			uptime: z.number(),
		}),
	}),
});

// BACKEND API
// ===========

export const SystemInfoResSchema: ZodType<ApiSystemInfo> = z.object({
	cpu_load: z.number(),
	memory: z.object({
		total: z.number(),
		used: z.number(),
		free: z.number(),
	}),
	storage: z.array(
		z.object({
			fs: z.string(),
			used: z.number(),
			size: z.number(),
			available: z.number(),
		})
	),
	primary_storage: z.object({
		fs: z.string(),
		used: z.number(),
		size: z.number(),
		available: z.number(),
	}),
	temperature: z.object({
		cpu: z.number().nullable().optional(),
		gpu: z.number().nullable().optional(),
	}),
	os: z.object({
		platform: z.string(),
		distro: z.string(),
		release: z.string(),
		uptime: z.number(),
		node: z.string(),
		npm: z.string().nullable(),
		timezone: z.string(),
	}),
	network: z.array(
		z.object({
			interface: z.string(),
			rx_bytes: z.number(),
			tx_bytes: z.number(),
		})
	),
	default_network: z.object({
		interface: z.string(),
		ip4: z.string(),
		ip6: z.string(),
		mac: z.string(),
		hostname: z.string(),
	}),
	display: z.object({
		resolution_x: z.number(),
		resolution_y: z.number(),
		current_res_x: z.number(),
		current_res_y: z.number(),
	}),
	process: z.object({
		pid: z.number(),
		uptime: z.number(),
	}),
});
