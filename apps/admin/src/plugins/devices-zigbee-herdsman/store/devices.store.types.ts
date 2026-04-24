import type { z } from 'zod';

import type { ZigbeeHerdsmanDeviceSchema } from './devices.store.schemas';

export type IZigbeeHerdsmanDevice = z.infer<typeof ZigbeeHerdsmanDeviceSchema>;
