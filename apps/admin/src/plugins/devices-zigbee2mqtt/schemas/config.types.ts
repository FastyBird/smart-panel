import type { z } from 'zod';

import type { Zigbee2mqttConfigEditFormSchema } from './config.schemas';

export type IZigbee2mqttConfigEditForm = z.infer<typeof Zigbee2mqttConfigEditFormSchema>;
