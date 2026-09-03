import type { z } from 'zod';

import type { NotificationsDiscordConfigEditFormSchema } from './config.schemas';

export type INotificationsDiscordConfigEditForm = z.infer<typeof NotificationsDiscordConfigEditFormSchema>;
