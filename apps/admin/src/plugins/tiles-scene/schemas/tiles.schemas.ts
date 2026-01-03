import { z } from 'zod';

import { TileAddFormSchema, TileEditFormSchema } from '../../../modules/dashboard';

export const SceneTileAddFormSchema = TileAddFormSchema.extend({
	scene: z.string().uuid(),
});

export const SceneTileEditFormSchema = TileEditFormSchema.extend({
	scene: z.string().uuid(),
});
