import { z } from 'zod';

import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const profileSchema = z.literal(HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY);

export const homeWritablePropertiesQuerySchema = z.object({ profile: profileSchema }).strict();

export const homeTriggerTargetsQuerySchema = z
	.object({
		profile: profileSchema,
		includeScenes: z.boolean(),
		includeSpaces: z.boolean(),
	})
	.strict();
