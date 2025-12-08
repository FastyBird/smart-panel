import { z } from 'zod';

import type { IConfigModule } from '../../config/store/config-modules.store.types';
import { MdnsConfigSchema } from './config.store.schemas';

export type IMdnsConfig = z.infer<typeof MdnsConfigSchema>;

export interface IMdnsConfigModule extends IConfigModule {
	serviceName: string;
	serviceType: string;
}
