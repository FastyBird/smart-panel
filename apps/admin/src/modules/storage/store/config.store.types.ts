import { z } from 'zod';

import type { IConfigModule } from '../../config/store/config-modules.store.types';
import { StorageConfigSchema } from './config.store.schemas';

export type IStorageConfig = z.infer<typeof StorageConfigSchema>;

export interface IStorageConfigModule extends IConfigModule {
	primaryStorage: string;
	fallbackStorage?: string;
}
