import { z } from 'zod';

import { ShellyNgConfigResSchema, type ShellyNgConfigSchema, ShellyNgConfigUpdateReqSchema } from './config.store.schemas';

export type IShellyNgConfig = z.infer<typeof ShellyNgConfigSchema>;

// BACKEND API
// ===========

export type IShellyNgConfigUpdateReq = z.infer<typeof ShellyNgConfigUpdateReqSchema>;

export type IShellyNgConfigRes = z.infer<typeof ShellyNgConfigResSchema>;
