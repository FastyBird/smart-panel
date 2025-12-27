import { z } from 'zod';

import { HousePageAddFormSchema, HousePageEditFormSchema } from './pages.schemas';

export type IHousePageAddForm = z.infer<typeof HousePageAddFormSchema>;

export type IHousePageEditForm = z.infer<typeof HousePageEditFormSchema>;
