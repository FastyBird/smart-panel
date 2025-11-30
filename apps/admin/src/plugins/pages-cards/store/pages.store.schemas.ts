import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	PageCreateReqSchema,
	PageResSchema,
	PageSchema,
	PageUpdateReqSchema,
} from '../../../modules/dashboard';
import { PagesCardsPluginCardsPageType, type components } from '../../../openapi';

import { CardCreateReqSchema, CardResSchema } from './cards.store.schemas';

type ApiCreateCardsPage = components['schemas']['PagesCardsPluginCreateCardsPage'];
type ApiUpdateCardsPage = components['schemas']['PagesCardsPluginUpdateCardsPage'];
type ApiCardsPage = components['schemas']['PagesCardsPluginDataCardsPage'];

// STORE STATE
// ===========

export const CardsPageSchema = PageSchema.extend({});

// BACKEND API
// ===========

export const CardsPageCreateReqSchema: ZodType<ApiCreateCardsPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesCardsPluginCardsPageType),
		cards: z.array(CardCreateReqSchema).optional(),
		data_source: z.array(DataSourceCreateReqSchema).optional(),
	})
);

export const CardsPageUpdateReqSchema: ZodType<ApiUpdateCardsPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesCardsPluginCardsPageType),
	})
);

export const CardsPageResSchema: ZodType<ApiCardsPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(PagesCardsPluginCardsPageType),
		cards: z.array(CardResSchema),
		data_source: z.array(DataSourceResSchema),
	})
);
