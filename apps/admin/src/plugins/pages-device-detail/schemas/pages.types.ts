import { z } from 'zod';

import { DeviceDetailPageAddFormSchema, DeviceDetailPageEditFormSchema } from './pages.schemas';

export type IDeviceDetailPageAddForm = z.infer<typeof DeviceDetailPageAddFormSchema>;

export type IDeviceDetailPageEditForm = z.infer<typeof DeviceDetailPageEditFormSchema>;
