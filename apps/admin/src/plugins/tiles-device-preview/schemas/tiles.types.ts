import { z } from 'zod';

import { DevicePreviewTileAddFormSchema, DevicePreviewTileEditFormSchema } from './tiles.schemas';

export type IDevicePreviewTileAddForm = z.infer<typeof DevicePreviewTileAddFormSchema>;

export type IDevicePreviewTileEditForm = z.infer<typeof DevicePreviewTileEditFormSchema>;
