import { type ZodType, z } from 'zod';

import { ItemIdSchema, TileCreateReqSchema, TileResSchema, TileSchema, TileUpdateReqSchema } from '../../../modules/dashboard';
import type {
	TilesScenePluginCreateSceneTileSchema,
	TilesScenePluginSceneTileSchema,
	TilesScenePluginUpdateSceneTileSchema,
} from '../../../openapi.constants';
import { TILES_SCENE_TYPE } from '../tiles-scene.constants';

type ApiCreateSceneTile = TilesScenePluginCreateSceneTileSchema;
type ApiUpdateSceneTile = TilesScenePluginUpdateSceneTileSchema;
type ApiSceneTile = TilesScenePluginSceneTileSchema;

// STORE STATE
// ===========

export const SceneTileSchema = TileSchema.extend({
	scene: ItemIdSchema,
	icon: z.string().trim().nullable().default(null),
});

// BACKEND API
// ===========

export const SceneTileCreateReqSchema: ZodType<ApiCreateSceneTile & { parent: { type: string; id: string } }> = TileCreateReqSchema.and(
	z.object({
		type: z.literal(TILES_SCENE_TYPE),
		scene: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);

export const SceneTileUpdateReqSchema: ZodType<ApiUpdateSceneTile & { parent: { type: string; id: string } }> = TileUpdateReqSchema.and(
	z.object({
		type: z.literal(TILES_SCENE_TYPE),
		scene: z.string().uuid().optional(),
		icon: z.string().trim().nullable().optional(),
	})
);

export const SceneTileResSchema: ZodType<ApiSceneTile> = TileResSchema.and(
	z.object({
		type: z.literal(TILES_SCENE_TYPE),
		scene: z.string().uuid(),
		icon: z.string().trim().nullable(),
	})
);
