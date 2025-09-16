import { z } from 'zod';

import { ShellyNgDeviceAddFormSchema, ShellyNgDeviceEditFormSchema } from './devices.schemas';

export type IShellyNgDeviceAddForm = z.infer<typeof ShellyNgDeviceAddFormSchema>;

export type IShellyNgDeviceEditForm = z.infer<typeof ShellyNgDeviceEditFormSchema>;
