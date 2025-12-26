import { z } from 'zod';

import { SpacePageAddFormSchema, SpacePageEditFormSchema } from './pages.schemas';

export type ISpacePageAddForm = z.infer<typeof SpacePageAddFormSchema>;

export type ISpacePageEditForm = z.infer<typeof SpacePageEditFormSchema>;
