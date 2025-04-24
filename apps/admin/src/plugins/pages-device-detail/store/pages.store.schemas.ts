import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { ItemIdSchema } from '../../../modules/devices';
import { PagesDeviceDetailPluginDeviceDetailPageType, type components } from '../../../openapi';

type ApiCreateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginCreateDeviceDetailPage'];
type ApiUpdateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginUpdateDeviceDetailPage'];
type ApiDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginDeviceDetailPage'];

// STORE STATE
// ===========

export const DeviceDetailPageSchema = PageSchema.extend({
	device: ItemIdSchema,
});

// BACKEND API
// ===========

export const DeviceDetailPageCreateReqSchema: ZodType<ApiCreateDeviceDetailPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesDeviceDetailPluginDeviceDetailPageType),
		device: z.string().uuid(),
	})
);

export const DeviceDetailPageUpdateReqSchema: ZodType<ApiUpdateDeviceDetailPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(PagesDeviceDetailPluginDeviceDetailPageType),
		device: z.string().uuid().optional(),
	})
);

export const DeviceDetailPageResSchema: ZodType<ApiDeviceDetailPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(PagesDeviceDetailPluginDeviceDetailPageType),
		device: z.string().uuid(),
	})
);
