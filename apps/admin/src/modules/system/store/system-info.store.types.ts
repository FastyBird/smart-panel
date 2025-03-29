import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiSystemInfo = components['schemas']['SystemSystemInfo'];

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
	temperature: z.object({
		cpu: z.number().nullable().optional(),
		gpu: z.number().nullable().optional(),
	}),
	os: z.object({
		platform: z.string(),
		distro: z.string(),
		release: z.string(),
		uptime: z.number(),
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
	}),
	display: z.object({
		resolutionX: z.number(),
		resolutionY: z.number(),
		currentResX: z.number(),
		currentResY: z.number(),
	}),
});
export type ISystemInfo = z.infer<typeof SystemInfoSchema>;

export const SystemInfoStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});
export type ISystemInfoStateSemaphore = z.infer<typeof SystemInfoStateSemaphoreSchema>;

// STORE ACTIONS
// =============

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
		temperature: z.object({
			cpu: z.number().nullable().optional(),
			gpu: z.number().nullable().optional(),
		}),
		os: z.object({
			platform: z.string(),
			distro: z.string(),
			release: z.string(),
			uptime: z.number(),
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
		}),
		display: z.object({
			resolutionX: z.number(),
			resolutionY: z.number(),
			currentResX: z.number(),
			currentResY: z.number(),
		}),
	}),
});
export type ISystemInfoSetActionPayload = z.infer<typeof SystemInfoSetActionPayloadSchema>;

// STORE
// =====

export interface ISystemInfoStoreState {
	data: Ref<ISystemInfo | null>;
	semaphore: Ref<ISystemInfoStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface ISystemInfoStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	set: (payload: ISystemInfoSetActionPayload) => ISystemInfo;
	get: () => Promise<ISystemInfo>;
}

export type SystemInfoStoreSetup = ISystemInfoStoreState & ISystemInfoStoreActions;

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
	temperature: z.object({
		cpu: z.number().nullable().optional(),
		gpu: z.number().nullable().optional(),
	}),
	os: z.object({
		platform: z.string(),
		distro: z.string(),
		release: z.string(),
		uptime: z.number(),
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
	}),
	display: z.object({
		resolution_x: z.number(),
		resolution_y: z.number(),
		current_res_x: z.number(),
		current_res_y: z.number(),
	}),
});
export type ISystemInfoRes = z.infer<typeof SystemInfoResSchema>;

// STORE
export type SystemInfoStore = Store<string, ISystemInfoStoreState, object, ISystemInfoStoreActions>;
