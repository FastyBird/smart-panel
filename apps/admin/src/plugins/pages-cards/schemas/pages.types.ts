import { z } from 'zod';

import { CardsPageAddFormSchema, CardsPageEditFormSchema } from './pages.schemas';

export type ICardsPageAddForm = z.infer<typeof CardsPageAddFormSchema>;

export type ICardsPageEditForm = z.infer<typeof CardsPageEditFormSchema>;
