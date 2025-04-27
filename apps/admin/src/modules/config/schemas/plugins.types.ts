import { z } from 'zod';

import { ConfigPluginEditFormSchema } from './plugins.schemas';

export type IConfigPluginEditForm = z.infer<typeof ConfigPluginEditFormSchema>;
