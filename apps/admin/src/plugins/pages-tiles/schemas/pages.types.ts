import { z } from 'zod';

import { TilesPageAddFormSchema, TilesPageEditFormSchema } from './pages.schemas';

export type ITilesPageAddForm = z.infer<typeof TilesPageAddFormSchema>;

export type ITilesPageEditForm = z.infer<typeof TilesPageEditFormSchema>;
