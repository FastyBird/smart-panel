/**
 * OpenAPI extra models for Pages Tiles plugin
 */
import { Type } from '@nestjs/common';

import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesConfigModel } from './models/config.model';

export const PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	TilesConfigModel,
	// Entities
	TilesPageEntity,
];
