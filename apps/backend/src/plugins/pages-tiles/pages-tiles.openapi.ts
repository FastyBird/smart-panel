/**
 * OpenAPI extra models for Pages Tiles plugin
 */
import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesConfigModel } from './models/config.model';

export const PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Data models
	TilesConfigModel,
	// Entities
	TilesPageEntity,
];
