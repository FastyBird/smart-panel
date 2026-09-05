import type { z } from 'zod';

import type { IConfigPlugin } from '../../../modules/config/store/config-plugins.store.types';

import type { HomeKitConfigSchema } from './config.store.schemas';

export type IHomeKitConfig = IConfigPlugin & z.infer<typeof HomeKitConfigSchema>;
