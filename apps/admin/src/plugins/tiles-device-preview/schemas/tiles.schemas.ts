import { z } from 'zod';

import { TileAddFormSchema, TileEditFormSchema } from '../../../modules/dashboard';

export const DevicePreviewTileAddFormSchema = TileAddFormSchema.extend({
	device: z.string().uuid(),
});

export const DevicePreviewTileEditFormSchema = TileEditFormSchema.extend({
	device: z.string().uuid(),
});
