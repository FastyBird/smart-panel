/**
 * OpenAPI extra models for Scenes Local plugin
 */
import { CreateLocalSceneActionDto } from './dto/create-local-scene-action.dto';
import { UpdateLocalSceneActionDto } from './dto/update-local-scene-action.dto';
import { LocalSceneActionEntity } from './entities/scenes-local.entity';

export const SCENES_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateLocalSceneActionDto,
	UpdateLocalSceneActionDto,
	// Entities
	LocalSceneActionEntity,
];
