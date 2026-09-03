import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const TailscaleConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	hostname: z.string().trim().min(1),
	loginServer: z.string().trim().min(1),
	acceptDns: z.boolean(),
	acceptRoutes: z.boolean(),
	advertiseTags: z.array(z.string().trim().min(1)),
	ssh: z.boolean(),
	// Mirror `RemoteAccessTailscalePluginUpdateConfig.serve_https`/`funnel`; the backend applies Serve and
	// Funnel changes through the node's managed service after the config is saved.
	serveHttps: z.boolean(),
	funnel: z.boolean(),
});
