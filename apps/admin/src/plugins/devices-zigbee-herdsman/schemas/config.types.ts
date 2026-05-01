import type { z } from 'zod';

import type { ZigbeeHerdsmanConfigEditFormSchema } from './config.schemas';

export type IZigbeeHerdsmanConfigEditForm = z.infer<typeof ZigbeeHerdsmanConfigEditFormSchema>;
