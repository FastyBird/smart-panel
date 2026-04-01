import { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { InfluxV2ConfigSchema } from './config.store.schemas';

export type IInfluxV2Config = z.infer<typeof InfluxV2ConfigSchema>;

export interface IInfluxV2ConfigPlugin extends IConfigPlugin {
	url: string;
	org: string;
	bucket: string;
	token?: string;
}
