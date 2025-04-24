import { z } from 'zod';

import { DeviceChannelDataSourceAddFormSchema, DeviceChannelDataSourceEditFormSchema } from './data-sources.schemas';

export type IDeviceChannelDataSourceAddForm = z.infer<typeof DeviceChannelDataSourceAddFormSchema>;

export type IDeviceChannelDataSourceEditForm = z.infer<typeof DeviceChannelDataSourceEditFormSchema>;
