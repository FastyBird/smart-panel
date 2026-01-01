import { z } from 'zod';

import { SceneActionAddFormSchema, SceneActionEditFormSchema, SceneAddFormSchema, SceneEditFormSchema } from './scenes.schemas';

export type ISceneAddForm = z.infer<typeof SceneAddFormSchema>;

export type ISceneEditForm = z.infer<typeof SceneEditFormSchema>;

export type ISceneActionAddForm = z.infer<typeof SceneActionAddFormSchema>;

export type ISceneActionEditForm = z.infer<typeof SceneActionEditFormSchema>;
