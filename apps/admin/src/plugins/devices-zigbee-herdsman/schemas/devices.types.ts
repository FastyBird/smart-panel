import type { z } from 'zod';

import type { ZigbeeHerdsmanDeviceAddFormSchema, ZigbeeHerdsmanDeviceEditFormSchema } from './devices.schemas';

export type IZigbeeHerdsmanDeviceAddForm = z.infer<typeof ZigbeeHerdsmanDeviceAddFormSchema>;
export type IZigbeeHerdsmanDeviceEditForm = z.infer<typeof ZigbeeHerdsmanDeviceEditFormSchema>;
