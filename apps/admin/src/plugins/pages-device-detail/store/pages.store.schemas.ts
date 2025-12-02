import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { ItemIdSchema } from '../../../modules/devices';
import type {
	PagesDeviceDetailPluginCreateDeviceDetailPageSchema,
	PagesDeviceDetailPluginUpdateDeviceDetailPageSchema,
	PagesDeviceDetailPluginDeviceDetailPageSchema,
} from '../../../openapi.constants';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';

type ApiCreateDeviceDetailPage = PagesDeviceDetailPluginCreateDeviceDetailPageSchema;
type ApiUpdateDeviceDetailPage = PagesDeviceDetailPluginUpdateDeviceDetailPageSchema;
type ApiDeviceDetailPage = PagesDeviceDetailPluginDeviceDetailPageSchema;

// STORE STATE
// ===========

export const DeviceDetailPageSchema = PageSchema.extend({
	device: ItemIdSchema,
});

// BACKEND API
// ===========

export const DeviceDetailPageCreateReqSchema: ZodType<ApiCreateDeviceDetailPage> = PageCreateReqSchema.and(
	z.object({
		type: z.literal(PAGES_DEVICE_DETAIL_TYPE),
		device: z.string().uuid(),
	})
);

export const DeviceDetailPageUpdateReqSchema: ZodType<ApiUpdateDeviceDetailPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.literal(PAGES_DEVICE_DETAIL_TYPE),
		device: z.string().uuid().optional(),
	})
);

export const DeviceDetailPageResSchema: ZodType<ApiDeviceDetailPage> = PageResSchema.and(
	z.object({
		type: z.literal(PAGES_DEVICE_DETAIL_TYPE),
		device: z.string().uuid(),
	})
);
