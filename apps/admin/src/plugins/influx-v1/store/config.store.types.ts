import { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { InfluxV1ConfigSchema } from './config.store.schemas';

export type IInfluxV1Config = z.infer<typeof InfluxV1ConfigSchema>;

export interface IInfluxV1ConfigPlugin extends IConfigPlugin {
	host: string;
	database: string;
	username?: string;
	password?: string;
}
