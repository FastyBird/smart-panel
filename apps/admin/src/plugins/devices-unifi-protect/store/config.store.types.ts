import { z } from 'zod';

import { ProtectConfigResSchema, type ProtectConfigSchema, ProtectConfigUpdateReqSchema } from './config.store.schemas';

export type IProtectConfig = z.infer<typeof ProtectConfigSchema>;
export type IProtectConfigRes = z.infer<typeof ProtectConfigResSchema>;
export type IProtectConfigUpdateReq = z.infer<typeof ProtectConfigUpdateReqSchema>;
