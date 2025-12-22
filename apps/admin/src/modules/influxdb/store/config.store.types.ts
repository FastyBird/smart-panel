import { z } from 'zod';

import type { IConfigModule } from '../../config/store/config-modules.store.types';
import { InfluxDbConfigSchema } from './config.store.schemas';

export type IInfluxDbConfig = z.infer<typeof InfluxDbConfigSchema>;

export interface IInfluxDbConfigModule extends IConfigModule {
	host: string;
	database: string;
	username?: string;
	password?: string;
}
