import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { ItemIdSchema } from '../../../modules/devices';
import { type components } from '../../../openapi.constants';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';

type ApiCreateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginCreateDeviceDetailPage'];
type ApiUpdateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginUpdateDeviceDetailPage'];
type ApiDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginDataDeviceDetailPage'];

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
