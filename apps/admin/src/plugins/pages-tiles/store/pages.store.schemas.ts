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

export const TilesPageSchema = PageSchema.extend({});

// BACKEND API
// ===========

export const TilesPageCreateReqSchema: ZodType<ApiCreateTilesPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
		tiles: z.array(TileCreateReqSchema).optional(),
		data_source: z.array(DataSourceCreateReqSchema).optional(),
	})
);

export const TilesPageUpdateReqSchema: ZodType<ApiUpdateTilesPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
	})
);

export const TilesPageResSchema: ZodType<ApiTilesPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(PagesTilesPluginTilesPageType),
		tiles: z.array(TileResSchema),
		data_source: z.array(DataSourceResSchema),
	})
);
