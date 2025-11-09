import { z } from 'zod';

import {
	ApiModuleSectionSchema,
	DashboardModuleSectionSchema,
	DevicesModuleSectionSchema,
	SystemModuleSectionSchema,
	WebSocketModuleSectionSchema,
} from './sections.schemas';

export type IApiModuleSection = z.infer<typeof ApiModuleSectionSchema>;

export type IWebSocketModuleSection = z.infer<typeof WebSocketModuleSectionSchema>;

export type ISystemModuleSection = z.infer<typeof SystemModuleSectionSchema>;

export type IDashboardModuleSection = z.infer<typeof DashboardModuleSectionSchema>;

export type IDevicesModuleSection = z.infer<typeof DevicesModuleSectionSchema>;
