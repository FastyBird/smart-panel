import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	PageCreateReqSchema,
	PageResSchema,
	PageSchema,
	PageUpdateReqSchema,
	TileCreateReqSchema,
	TileResSchema,
} from '../../../modules/dashboard';
import { PagesTilesPluginTilesPageType, type components } from '../../../openapi';

type ApiCreateTilesPage = components['schemas']['PagesTilesPluginCreateTilesPage'];
type ApiUpdateTilesPage = components['schemas']['PagesTilesPluginUpdateTilesPage'];
type ApiTilesPage = components['schemas']['PagesTilesPluginTilesPage'];

// STORE STATE
// ===========

export const TilesPageSchema = PageSchema.extend({
	tileSize: z.number().gte(0).nullable().default(null),
	rows: z.number().gte(1).nullable().default(null),
	cols: z.number().gte(1).nullable().default(null),
});

// BACKEND API
// ===========

export const TilesPageCreateReqSchema: ZodType<ApiCreateTilesPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
		tiles: z.array(TileCreateReqSchema).optional(),
		data_source: z.array(DataSourceCreateReqSchema).optional(),
		tile_size: z.number().gte(0).nullable().default(null),
		rows: z.number().gte(1).nullable().default(null),
		cols: z.number().gte(1).nullable().default(null),
	})
);

export const TilesPageUpdateReqSchema: ZodType<ApiUpdateTilesPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
		tile_size: z.number().gte(0).nullable(),
		rows: z.number().gte(1).nullable(),
		cols: z.number().gte(1).nullable(),
	})
);

export const TilesPageResSchema: ZodType<ApiTilesPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
		tiles: z.array(TileResSchema),
		data_source: z.array(DataSourceResSchema),
		tile_size: z.number().nullable(),
		rows: z.number().nullable(),
		cols: z.number().nullable(),
	})
);
