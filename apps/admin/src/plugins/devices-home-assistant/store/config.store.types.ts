import { z } from 'zod';

import { HomeAssistantConfigResSchema, type HomeAssistantConfigSchema, HomeAssistantConfigUpdateReqSchema } from './config.store.schemas';

export type IHomeAssistantConfig = z.infer<typeof HomeAssistantConfigSchema>;

// BACKEND API
// ===========

export type IHomeAssistantConfigUpdateReq = z.infer<typeof HomeAssistantConfigUpdateReqSchema>;

export type IHomeAssistantConfigRes = z.infer<typeof HomeAssistantConfigResSchema>;
