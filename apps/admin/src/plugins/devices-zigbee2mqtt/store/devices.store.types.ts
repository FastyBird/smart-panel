import type { z } from 'zod';

import type { Zigbee2mqttDeviceSchema } from './devices.store.schemas';

export type IZigbee2mqttDevice = z.infer<typeof Zigbee2mqttDeviceSchema>;
