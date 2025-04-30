import { z } from 'zod';

import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from './channels.properties.schemas';

export type IChannelPropertyAddForm = z.infer<typeof ChannelPropertyAddFormSchema>;

export type IChannelPropertyEditForm = z.infer<typeof ChannelPropertyEditFormSchema>;
