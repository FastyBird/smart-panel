import { z } from 'zod';

import { ChannelAddFormSchema, ChannelEditFormSchema } from './channels.schemas';

export type IChannelAddForm = z.infer<typeof ChannelAddFormSchema>;

export type IChannelEditForm = z.infer<typeof ChannelEditFormSchema>;
