import { z } from 'zod';

import { ShellyV1ConfigResSchema, type ShellyV1ConfigSchema, ShellyV1ConfigUpdateReqSchema } from './config.store.schemas';

export type IShellyV1Config = z.infer<typeof ShellyV1ConfigSchema>;

// BACKEND API
// ===========

export type IShellyV1ConfigUpdateReq = z.infer<typeof ShellyV1ConfigUpdateReqSchema>;

export type IShellyV1ConfigRes = z.infer<typeof ShellyV1ConfigResSchema>;
