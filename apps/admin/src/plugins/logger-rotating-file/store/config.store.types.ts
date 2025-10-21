import { z } from 'zod';

import { RotatingFileConfigResSchema, type RotatingFileConfigSchema, RotatingFileConfigUpdateReqSchema } from './config.store.schemas';

export type IRotatingFileConfig = z.infer<typeof RotatingFileConfigSchema>;

// BACKEND API
// ===========

export type IRotatingFileConfigUpdateReq = z.infer<typeof RotatingFileConfigUpdateReqSchema>;

export type IRotatingFileConfigRes = z.infer<typeof RotatingFileConfigResSchema>;
