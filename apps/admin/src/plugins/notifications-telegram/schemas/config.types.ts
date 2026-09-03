import type { z } from 'zod';

import type { NotificationsTelegramConfigEditFormSchema } from './config.schemas';

export type INotificationsTelegramConfigEditForm = z.infer<typeof NotificationsTelegramConfigEditFormSchema>;
