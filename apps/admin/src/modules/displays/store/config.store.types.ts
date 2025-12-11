import { z } from 'zod';

import type { IConfigModule } from '../../config/store/config-modules.store.types';
import { DisplaysConfigSchema } from './config.store.schemas';

export type IDisplaysConfig = z.infer<typeof DisplaysConfigSchema>;

export interface IDisplaysConfigModule extends IConfigModule {
	type: 'displays-module';
	deploymentMode: 'standalone' | 'all-in-one' | 'combined';
	permitJoinDurationMs: number;
}
