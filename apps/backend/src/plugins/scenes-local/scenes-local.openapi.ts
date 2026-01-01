/**
 * OpenAPI extra models for Scenes Local plugin
 */
import { CreateLocalSceneActionDto } from './dto/create-local-scene-action.dto';
import { ScenesLocalUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateLocalSceneActionDto } from './dto/update-local-scene-action.dto';
import { LocalSceneActionEntity } from './entities/scenes-local.entity';
import { ScenesLocalConfigModel } from './models/config.model';

export const SCENES_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Config
	ScenesLocalConfigModel,
	ScenesLocalUpdatePluginConfigDto,
	// DTOs
	CreateLocalSceneActionDto,
	UpdateLocalSceneActionDto,
	// Entities
	LocalSceneActionEntity,
];
