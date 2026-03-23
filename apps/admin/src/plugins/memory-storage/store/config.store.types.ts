import { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';
import { MemoryStorageConfigSchema } from './config.store.schemas';

export type IMemoryStorageConfig = z.infer<typeof MemoryStorageConfigSchema>;

export type IMemoryStorageConfigPlugin = IConfigPlugin;
