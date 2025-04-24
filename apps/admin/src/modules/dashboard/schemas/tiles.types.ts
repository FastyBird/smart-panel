import { z } from 'zod';

import { TileAddFormSchema, TileEditFormSchema } from './tiles.schemas';

export type ITileAddForm = z.infer<typeof TileAddFormSchema>;

export type ITileEditForm = z.infer<typeof TileEditFormSchema>;
