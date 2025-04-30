import { z } from 'zod';

import { DeviceAddFormSchema, DeviceEditFormSchema } from './devices.schemas';

export type IDeviceAddForm = z.infer<typeof DeviceAddFormSchema>;

export type IDeviceEditForm = z.infer<typeof DeviceEditFormSchema>;
