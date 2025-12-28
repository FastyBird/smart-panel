import { z } from 'zod';

import { HouseModesPageAddFormSchema, HouseModesPageEditFormSchema } from './pages.schemas';

export type IHouseModesPageAddForm = z.infer<typeof HouseModesPageAddFormSchema>;

export type IHouseModesPageEditForm = z.infer<typeof HouseModesPageEditFormSchema>;
