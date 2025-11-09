import { z } from 'zod';

import {
	ApiModuleSectionSchema,
	DashboardModuleSectionSchema,
	DevicesModuleSectionSchema,
	SystemModuleSectionSchema,
	WebSocketModuleSectionSchema,
} from './schemas/sections.schemas';

export const STATS_MODULE_PREFIX = 'stats-module';

export const STATS_MODULE_NAME = 'stats-module';

export const STATS_MODULE_EVENT_PREFIX = 'StatsModule.';

export enum EventType {
	STATS_INFO = 'StatsModule.Stats.Info',
}

export const RouteNames = {
	STATS: 'stats_module-module',
};

export const SECTION_SCHEMAS: Record<string, z.ZodTypeAny> = {
	'api-module': ApiModuleSectionSchema,
	'websocket-module': WebSocketModuleSectionSchema,
	'system-module': SystemModuleSectionSchema,
	'dashboard-module': DashboardModuleSectionSchema,
	'devices-module': DevicesModuleSectionSchema,
};

export const STALE_MS = 5 * 60 * 1000;
