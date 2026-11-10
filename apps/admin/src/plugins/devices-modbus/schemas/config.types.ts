import type { z } from 'zod';

import type { ModbusConfigEditFormSchema } from './config.schemas';

export type IModbusConfigEditForm = z.infer<typeof ModbusConfigEditFormSchema>;
