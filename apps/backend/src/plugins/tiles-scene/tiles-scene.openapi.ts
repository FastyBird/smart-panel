/**
 * OpenAPI extra models for Tiles Scene plugin
 */
import { CreateSceneTileDto, ReqCreateSceneTileDto } from './dto/create-tile.dto';
import { SceneUpdateConfigDto } from './dto/update-config.dto';
import { ReqUpdateSceneTileDto, UpdateSceneTileDto } from './dto/update-tile.dto';
import { SceneTileEntity } from './entities/tiles-scene.entity';
import { SceneConfigModel } from './models/config.model';

export const TILES_SCENE_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateSceneTileDto,
	ReqCreateSceneTileDto,
	UpdateSceneTileDto,
	ReqUpdateSceneTileDto,
	SceneUpdateConfigDto,
	// Data models
	SceneConfigModel,
	// Entities
	SceneTileEntity,
];
