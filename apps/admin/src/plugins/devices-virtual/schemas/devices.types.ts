import { z } from 'zod';

import { VirtualDeviceAddFormSchema, VirtualDeviceEditFormSchema } from './devices.schemas';

export type IVirtualDeviceAddForm = z.infer<typeof VirtualDeviceAddFormSchema>;

export type IVirtualDeviceEditForm = z.infer<typeof VirtualDeviceEditFormSchema>;
