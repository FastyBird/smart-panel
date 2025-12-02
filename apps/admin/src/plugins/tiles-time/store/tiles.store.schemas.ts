import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { type components } from '../../../openapi.constants';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

type ApiCreateTimeTile = components['schemas']['TilesTimePluginCreateTimeTile'];
type ApiUpdateTimeTile = components['schemas']['TilesTimePluginUpdateTimeTile'];
type ApiTimeTile = components['schemas']['TilesTimePluginDataTimeTile'];

// STORE STATE
// ===========

export const TimeTileSchema = TileSchema.extend({});

// BACKEND API
// ===========

export const TimeTileCreateReqSchema: ZodType<ApiCreateTimeTile & { parent: { type: string; id: string } }> = TileCreateReqSchema.and(
	z.object({
		type: z.literal(TILES_TIME_TYPE),
	})
);

export const TimeTileUpdateReqSchema: ZodType<ApiUpdateTimeTile & { parent: { type: string; id: string } }> = TileUpdateReqSchema.and(
	z.object({
		type: z.literal(TILES_TIME_TYPE),
	})
);

export const TimeTileResSchema: ZodType<ApiTimeTile> = TileResSchema.and(
	z.object({
		type: z.literal(TILES_TIME_TYPE),
	})
);
