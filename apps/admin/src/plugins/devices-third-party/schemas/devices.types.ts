import { z } from 'zod';

import { ThirdPartyDeviceAddFormSchema, ThirdPartyDeviceEditFormSchema } from './devices.schemas';

export type IThirdPartyDeviceAddForm = z.infer<typeof ThirdPartyDeviceAddFormSchema>;

export type IThirdPartyDeviceEditForm = z.infer<typeof ThirdPartyDeviceEditFormSchema>;
