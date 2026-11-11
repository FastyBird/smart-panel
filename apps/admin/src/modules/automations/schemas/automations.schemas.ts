import { z } from 'zod';

import { AUTOMATION_DESCRIPTION_MAX_LENGTH, AUTOMATION_NAME_MAX_LENGTH, AutomationMode } from '../automations.constants';

export const AutomationAddFormSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH),
	description: z.string().trim().max(AUTOMATION_DESCRIPTION_MAX_LENGTH).nullable().optional(),
	spaceId: z.string().uuid().nullable().optional(),
	mode: z.nativeEnum(AutomationMode).default(AutomationMode.restart),
});

export const AutomationEditFormSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH),
	description: z.string().trim().max(AUTOMATION_DESCRIPTION_MAX_LENGTH).nullable().optional(),
	spaceId: z.string().uuid().nullable().optional(),
	mode: z.nativeEnum(AutomationMode),
});
