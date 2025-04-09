import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	PageCreateReqSchema,
	PageResSchema,
	PageSchema,
	PageUpdateReqSchema,
} from '../../../modules/dashboard';
import { DashboardCardsPageType, type components } from '../../../openapi';

import { CardCreateReqSchema, CardResSchema } from './cards.store.schemas';

type ApiCreateCardsPage = components['schemas']['DashboardCreateCardsPage'];
type ApiUpdateCardsPage = components['schemas']['DashboardUpdateCardsPage'];
type ApiCardsPage = components['schemas']['DashboardCardsPage'];

// STORE STATE
// ===========

export const CardsPageSchema = PageSchema.extend({});

// BACKEND API
// ===========

export const CardsPageCreateReqSchema: ZodType<ApiCreateCardsPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardCreateReqSchema).optional(),
		data_source: z.array(DataSourceCreateReqSchema).optional(),
	})
);

export const CardsPageUpdateReqSchema: ZodType<ApiUpdateCardsPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
	})
);

export const CardsPageResSchema: ZodType<ApiCardsPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardCardsPageType),
		cards: z.array(CardResSchema),
		data_source: z.array(DataSourceResSchema),
	})
);
