import { z } from 'zod';

import { CardsPageCreateReqSchema, CardsPageResSchema, CardsPageSchema, CardsPageUpdateReqSchema } from './pages.store.schemas';

// STORE STATE
// ===========

export type ICardsPage = z.infer<typeof CardsPageSchema>;

// BACKEND API
// ===========

export type ICardPageCreateReq = z.infer<typeof CardsPageCreateReqSchema>;

export type ICardsPageUpdateReq = z.infer<typeof CardsPageUpdateReqSchema>;

export type ICardsPageRes = z.infer<typeof CardsPageResSchema>;
