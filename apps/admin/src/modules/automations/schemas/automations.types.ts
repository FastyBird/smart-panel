import { z } from 'zod';

import { AutomationAddFormSchema, AutomationEditFormSchema } from './automations.schemas';

export type IAutomationAddForm = z.infer<typeof AutomationAddFormSchema>;

export type IAutomationEditForm = z.infer<typeof AutomationEditFormSchema>;
