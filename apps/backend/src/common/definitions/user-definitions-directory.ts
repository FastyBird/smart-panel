import { resolve } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../utils/config.utils';

// <repo>/var/data, the same default as the core ConfigService.configPath
const DEFAULT_USER_DEFINITIONS_DIRECTORY = resolve(__dirname, '../../../../../var/data');

export function resolveUserDefinitionsDirectory(config: NestConfigService): string {
	return resolve(getEnvValue<string>(config, 'FB_CONFIG_PATH', DEFAULT_USER_DEFINITIONS_DIRECTORY));
}
