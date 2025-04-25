import { type ZodType, z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	DataSourceSchema,
	DataSourceUpdateReqSchema,
	ItemIdSchema,
} from '../../../modules/dashboard';
import { DataSourcesDeviceChannelPluginDeviceChannelDataSourceType, type components } from '../../../openapi';

type ApiCreateDeviceChannelDataSource = components['schemas']['DataSourcesDeviceChannelPluginCreateDeviceChannelDataSource'];
type ApiUpdateDeviceChannelDataSource = components['schemas']['DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource'];
type ApiDeviceChannelDataSource = components['schemas']['DataSourcesDeviceChannelPluginDeviceChannelDataSource'];

// STORE STATE
// ===========

export const DeviceChannelDataSourceSchema = DataSourceSchema.extend({
	device: ItemIdSchema,
	channel: ItemIdSchema,
	property: ItemIdSchema,
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});

// BACKEND API
// ===========

export const DeviceChannelDataSourceCreateReqSchema: ZodType<ApiCreateDeviceChannelDataSource & { parent: { type: string; id: string } }> =
	DataSourceCreateReqSchema.and(
		z.object({
			type: z.nativeEnum(DataSourcesDeviceChannelPluginDeviceChannelDataSourceType),
			device: z.string().uuid(),
			channel: z.string().uuid(),
			property: z.string().uuid(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
		})
	);

export const DeviceChannelDataSourceUpdateReqSchema: ZodType<ApiUpdateDeviceChannelDataSource & { parent: { type: string; id: string } }> =
	DataSourceUpdateReqSchema.and(
		z.object({
			type: z.nativeEnum(DataSourcesDeviceChannelPluginDeviceChannelDataSourceType),
			device: z.string().uuid().optional(),
			channel: z.string().uuid().optional(),
			property: z.string().uuid().optional(),
			icon: z
				.string()
				.trim()
				.transform((val) => (val === '' ? null : val))
				.nullable()
				.optional(),
		})
	);

export const DeviceChannelDataSourceResSchema: ZodType<ApiDeviceChannelDataSource> = DataSourceResSchema.and(
	z.object({
		type: z.nativeEnum(DataSourcesDeviceChannelPluginDeviceChannelDataSourceType),
		device: z.string().uuid(),
		channel: z.string().uuid(),
		property: z.string().uuid(),
		icon: z.string().nullable(),
	})
);
