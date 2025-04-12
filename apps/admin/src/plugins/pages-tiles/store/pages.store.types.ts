import { z } from 'zod';

import { TilesPageCreateReqSchema, TilesPageResSchema, type TilesPageSchema, TilesPageUpdateReqSchema } from './pages.store.schemas';

// STORE STATE
// ===========

export type ITilesPage = z.infer<typeof TilesPageSchema>;

// BACKEND API
// ===========

export type ITilePageCreateReq = z.infer<typeof TilesPageCreateReqSchema>;

export type ITilesPageUpdateReq = z.infer<typeof TilesPageUpdateReqSchema>;

export type ITilesPageRes = z.infer<typeof TilesPageResSchema>;
