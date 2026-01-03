import { z } from 'zod';

import { SceneTileAddFormSchema, SceneTileEditFormSchema } from './tiles.schemas';

export type ISceneTileAddForm = z.infer<typeof SceneTileAddFormSchema>;

export type ISceneTileEditForm = z.infer<typeof SceneTileEditFormSchema>;
