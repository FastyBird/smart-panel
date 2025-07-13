import { z } from 'zod';

import { DataSourceAddFormSchema, DataSourceEditFormSchema } from '../../../modules/dashboard';

export const DeviceChannelDataSourceAddFormSchema = DataSourceAddFormSchema.extend({
	device: z.string().uuid(),
	channel: z.string().uuid(),
	property: z.string().uuid(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.default(null)
		.optional(),
});

export const DeviceChannelDataSourceEditFormSchema = DataSourceEditFormSchema.extend({
	device: z.string().uuid(),
	channel: z.string().uuid(),
	property: z.string().uuid(),
	icon: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.default(null)
		.optional(),
});
