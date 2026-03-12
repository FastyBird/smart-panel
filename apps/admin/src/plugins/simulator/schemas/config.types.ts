import { z } from 'zod';

import { SimulatorConfigEditFormSchema } from './config.schemas';

export type ISimulatorConfigEditForm = z.infer<typeof SimulatorConfigEditFormSchema>;
