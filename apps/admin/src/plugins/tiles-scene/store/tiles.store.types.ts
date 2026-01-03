import { z } from 'zod';

import { SceneTileCreateReqSchema, SceneTileResSchema, SceneTileSchema, SceneTileUpdateReqSchema } from './tiles.store.schemas';

// STORE STATE
// ===========

export type ISceneTile = z.infer<typeof SceneTileSchema>;

// BACKEND API
// ===========

export type ISceneTileCreateReq = z.infer<typeof SceneTileCreateReqSchema>;

export type ISceneTileUpdateReq = z.infer<typeof SceneTileUpdateReqSchema>;

export type ISceneTileRes = z.infer<typeof SceneTileResSchema>;
