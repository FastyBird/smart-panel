import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

export const TailscaleConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	hostname: z.string().trim().min(1),
	loginServer: z.string().trim().min(1),
	acceptDns: z.boolean(),
	acceptRoutes: z.boolean(),
	advertiseTags: z.array(z.string().trim().min(1)),
	ssh: z.boolean(),
	// RA-6 (Serve/Funnel) accepts only its own defaults today - see
	// `RemoteAccessTailscalePluginUpdateConfig.serve_https`/`funnel` on the backend - but the
	// fields are still edited here so the form has somewhere to hold them once RA-6 lands.
	serveHttps: z.boolean(),
	funnel: z.boolean(),
});
