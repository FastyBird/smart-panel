import { z } from 'zod';

export const ApiModuleSectionSchema = z.object({
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
});

export const WebSocketModuleSectionSchema = z.object({
	clientsNow: z.object({
		value: z.number(),
		lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	}),
	availability5m: z.object({
		value: z.number(),
		lastUpdated: z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date))),
	}),
});

export const SystemModuleSectionSchema = z.object({
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
});

export const DashboardModuleSectionSchema = z.object({
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
});

export const DevicesModuleSectionSchema = z.object({
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
});
