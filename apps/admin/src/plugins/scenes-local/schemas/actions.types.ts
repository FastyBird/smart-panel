import { z } from 'zod';

import { LocalSceneActionAddFormSchema, LocalSceneActionEditFormSchema } from './actions.schemas';

export type ILocalSceneActionAddForm = z.infer<typeof LocalSceneActionAddFormSchema>;

export type ILocalSceneActionEditForm = z.infer<typeof LocalSceneActionEditFormSchema>;
