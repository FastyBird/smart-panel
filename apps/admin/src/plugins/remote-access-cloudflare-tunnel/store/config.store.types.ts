import { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

import { CloudflareTunnelConfigSchema } from './config.store.schemas';

export type ICloudflareTunnelConfig = z.infer<typeof CloudflareTunnelConfigSchema>;

export interface ICloudflareTunnelConfigPlugin extends IConfigPlugin {
	publicHostname: string | null;
	protocol: 'auto' | 'http2' | 'quic';
	tunnelToken?: string | null;
	tunnelTokenConfigured: boolean;
}
