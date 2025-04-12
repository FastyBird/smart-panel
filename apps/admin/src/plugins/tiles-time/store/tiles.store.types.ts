import { z } from 'zod';

import { TimeTileCreateReqSchema, TimeTileResSchema, TimeTileSchema, TimeTileUpdateReqSchema } from './tiles.store.schemas';

// STORE STATE
// ===========

export type ITimeTile = z.infer<typeof TimeTileSchema>;

// BACKEND API
// ===========

export type ITimeTileCreateReq = z.infer<typeof TimeTileCreateReqSchema>;

export type ITimeTileUpdateReq = z.infer<typeof TimeTileUpdateReqSchema>;

export type ITimeTileRes = z.infer<typeof TimeTileResSchema>;
