import type { z } from 'zod';

import type { WledDeviceAddFormSchema, WledDeviceEditFormSchema } from './devices.schemas';

export type IWledDeviceAddForm = z.infer<typeof WledDeviceAddFormSchema>;
export type IWledDeviceEditForm = z.infer<typeof WledDeviceEditFormSchema>;
