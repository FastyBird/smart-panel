import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { TilesTimePluginTimeTileType, type components } from '../../../openapi';

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
		type: z.nativeEnum(TilesTimePluginTimeTileType),
	})
);

export const TimeTileUpdateReqSchema: ZodType<ApiUpdateTimeTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(TilesTimePluginTimeTileType),
	})
);

export const TimeTileResSchema: ZodType<ApiTimeTile & { parent: { type: string; id: string } }> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(TilesTimePluginTimeTileType),
	})
);
