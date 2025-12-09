import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

export const MdnsConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	serviceName: z.string().min(1),
	serviceType: z.string().min(1),
});
