/**
 * OpenAPI extra models for Pages Tiles plugin
 */
import { CreateTilesPageDto } from './dto/create-page.dto';
import { TilesUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateTilesPageDto } from './dto/update-page.dto';
import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesConfigModel } from './models/config.model';

export const PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateTilesPageDto,
	UpdateTilesPageDto,
	TilesUpdatePluginConfigDto,
	// Data models
	TilesConfigModel,
	// Entities
	TilesPageEntity,
];
