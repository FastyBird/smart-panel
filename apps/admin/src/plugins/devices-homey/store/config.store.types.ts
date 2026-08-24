import { z } from 'zod';

import { HomeyConfigResSchema, type HomeyConfigSchema, HomeyConfigUpdateReqSchema } from './config.store.schemas';

export type IHomeyConfig = z.infer<typeof HomeyConfigSchema>;
export type IHomeyConfigRes = z.infer<typeof HomeyConfigResSchema>;
export type IHomeyConfigUpdateReq = z.infer<typeof HomeyConfigUpdateReqSchema>;
