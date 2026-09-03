import { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

import { TailscaleConfigSchema } from './config.store.schemas';

export type ITailscaleConfig = z.infer<typeof TailscaleConfigSchema>;

export interface ITailscaleConfigPlugin extends IConfigPlugin {
	hostname: string;
	loginServer: string;
	acceptDns: boolean;
	acceptRoutes: boolean;
	advertiseTags: string[];
	ssh: boolean;
	serveHttps: boolean;
	funnel: boolean;
}
