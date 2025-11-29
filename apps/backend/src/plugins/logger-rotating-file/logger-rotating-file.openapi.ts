/**
 * OpenAPI extra models for Logger Rotating File plugin
 */
import { Type } from '@nestjs/common';

import { RotatingFileConfigModel } from './models/config.model';

export const LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	RotatingFileConfigModel,
];
