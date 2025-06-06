import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from '../../../modules/dashboard';

export const DeviceDetailPageAddFormSchema = PageAddFormSchema.extend({
	device: z.string().uuid(),
});

export const DeviceDetailPageEditFormSchema = PageEditFormSchema.extend({
	device: z.string().uuid(),
});
