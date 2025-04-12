import { type ZodType, z } from 'zod';

import { PageCreateReqSchema, PageResSchema, PageSchema, PageUpdateReqSchema } from '../../../modules/dashboard';
import { ItemIdSchema } from '../../../modules/devices/store/types';
import { DashboardDeviceDetailPageType, type components } from '../../../openapi';

type ApiCreateDeviceDetailPage = components['schemas']['DashboardCreateDeviceDetailPage'];
type ApiUpdateDeviceDetailPage = components['schemas']['DashboardUpdateDeviceDetailPage'];
type ApiDeviceDetailPage = components['schemas']['DashboardDeviceDetailPage'];

// STORE STATE
// ===========

export const DeviceDetailPageSchema = PageSchema.extend({
	device: ItemIdSchema,
});

// BACKEND API
// ===========

export const DeviceDetailPageCreateReqSchema: ZodType<ApiCreateDeviceDetailPage> = PageCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);

export const DeviceDetailPageUpdateReqSchema: ZodType<ApiUpdateDeviceDetailPage> = PageUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid().optional(),
	})
);

export const DeviceDetailPageResSchema: ZodType<ApiDeviceDetailPage> = PageResSchema.and(
	z.object({
		type: z.nativeEnum(DashboardDeviceDetailPageType),
		device: z.string().uuid(),
	})
);
