import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	PageCreateReqSchema,
	PageResSchema,
	PageSchema,
	PageUpdateReqSchema,
} from '../../../modules/dashboard';
import type {
	PagesCardsPluginCreateCardsPageSchema,
	PagesCardsPluginUpdateCardsPageSchema,
	PagesCardsPluginCardsPageSchema,
} from '../../../openapi.constants';
import { PAGES_CARDS_TYPE } from '../pages-cards.contants';

import { CardCreateReqSchema, CardResSchema } from './cards.store.schemas';

type ApiCreateCardsPage = PagesCardsPluginCreateCardsPageSchema;
type ApiUpdateCardsPage = PagesCardsPluginUpdateCardsPageSchema;
type ApiCardsPage = PagesCardsPluginCardsPageSchema;

// STORE STATE
// ===========

export const CardsPageSchema = PageSchema.extend({});

// BACKEND API
// ===========

export const CardsPageCreateReqSchema: ZodType<ApiCreateCardsPage> = PageCreateReqSchema.and(
	z.object({
		type: z.literal(PAGES_CARDS_TYPE),
		cards: z.array(CardCreateReqSchema).optional(),
		data_source: z.array(DataSourceCreateReqSchema).optional(),
	})
);

export const CardsPageUpdateReqSchema: ZodType<ApiUpdateCardsPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.literal(PAGES_CARDS_TYPE),
	})
);

export const CardsPageResSchema: ZodType<ApiCardsPage> = PageResSchema.and(
	z.object({
		type: z.literal(PAGES_CARDS_TYPE),
		cards: z.array(CardResSchema),
		data_source: z.array(DataSourceResSchema),
	})
);
