import { type ZodType, z } from 'zod';

import { TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import { DashboardTimeTileType, type components } from '../../../openapi';

type ApiCreateTimeTile = components['schemas']['DashboardCreateTimeTile'];
type ApiUpdateTimeTile = components['schemas']['DashboardUpdateTimeTile'];
type ApiTimeTile = components['schemas']['DashboardTimeTile'];

// STORE STATE
// ===========

export const TimeTileSchema = TileSchema.extend({});

// BACKEND API
// ===========

export const TimeTileCreateReqSchema: ZodType<ApiCreateTimeTile> = TileCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);

export const TimeTileUpdateReqSchema: ZodType<ApiUpdateTimeTile> = TileUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);

export const TimeTileResSchema: ZodType<ApiTimeTile> = TileResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardTimeTileType),
	})
);
