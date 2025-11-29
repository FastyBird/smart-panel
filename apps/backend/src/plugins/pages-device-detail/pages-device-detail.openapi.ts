/**
 * OpenAPI extra models for Pages Device Detail plugin
 */
import { Type } from '@nestjs/common';

import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { DeviceDetailConfigModel } from './models/config.model';

export const PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	DeviceDetailConfigModel,
	// Entities
	DeviceDetailPageEntity,
];
