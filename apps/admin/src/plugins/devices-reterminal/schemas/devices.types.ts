import type { z } from 'zod';

import type { ReTerminalDeviceAddFormSchema, ReTerminalDeviceEditFormSchema } from './devices.schemas';

export type IReTerminalDeviceAddForm = z.infer<typeof ReTerminalDeviceAddFormSchema>;
export type IReTerminalDeviceEditForm = z.infer<typeof ReTerminalDeviceEditFormSchema>;
