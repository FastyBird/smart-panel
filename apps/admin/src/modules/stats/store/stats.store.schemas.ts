import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiStats = components['schemas']['StatsModuleDataStats'];

// STORE STATE
// ===========

export const StatsSchema = z.object({
	'api-module': z
		.object({
			reqPerMin: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			errorRate5m: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			p95Ms5m: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
		})
		.optional(),
	'websocket-module': z
		.object({
			clientsNow: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			availability5m: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
		})
		.optional(),
	'system-module': z
		.object({
			cpuLoad1m: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			memUsedPct: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			diskUsedPct: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			systemUptimeSec: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			processUptimeSec: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			temperatureCpu: z.object({
				value: z.number().nullable(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			temperatureGpu: z.object({
				value: z.number().nullable(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
		})
		.optional(),
	'dashboard-module': z
		.object({
			registeredPages: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			registeredTiles: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			registeredDataSources: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
		})
		.optional(),
	'devices-module': z
		.object({
			registeredDevices: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			registeredChannels: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			updatesPerMin: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			updatesToday: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
			onlineNow: z.object({
				value: z.number(),
				lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
			}),
		})
		.optional(),
});

export const StatsStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const StatsOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const StatsSetActionPayloadSchema = z.object({
	data: z.object({
		'api-module': z
			.object({
				reqPerMin: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				errorRate5m: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				p95Ms5m: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
			})
			.optional(),
		'websocket-module': z
			.object({
				clientsNow: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				availability5m: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
			})
			.optional(),
		'system-module': z
			.object({
				cpuLoad1m: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				memUsedPct: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				diskUsedPct: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				systemUptimeSec: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				processUptimeSec: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				temperatureCpu: z.object({
					value: z.number().nullable(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				temperatureGpu: z.object({
					value: z.number().nullable(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
			})
			.optional(),
		'dashboard-module': z
			.object({
				registeredPages: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				registeredTiles: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				registeredDataSources: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
			})
			.optional(),
		'devices-module': z
			.object({
				registeredDevices: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				registeredChannels: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				updatesPerMin: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				updatesToday: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
				onlineNow: z.object({
					value: z.number(),
					lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
				}),
			})
			.optional(),
	}),
});

// BACKEND API
// ===========

export const StatsValueSchema = z.object({
	value: z.number().nullable(),
	last_updated: z.string().datetime({ offset: true }),
});

export const ModuleStatsSchema = z.record(z.string(), StatsValueSchema);

export const StatsResSchema: ZodType<ApiStats> = z
	.object({
		'websocket-module': ModuleStatsSchema.optional(),
		'system-module': ModuleStatsSchema.optional(),
		'api-module': ModuleStatsSchema.optional(),
		'dashboard-module': ModuleStatsSchema.optional(),
		'devices-module': ModuleStatsSchema.optional(),
	})
	.catchall(ModuleStatsSchema);
