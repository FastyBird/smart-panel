import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from './pages.schemas';

export type IPageAddForm = z.infer<typeof PageAddFormSchema>;

export type IPageEditForm = z.infer<typeof PageEditFormSchema>;
