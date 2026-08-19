/**
 * OpenAPI extra models for Scenes module
 */
import { SceneActionEntity, SceneEntity } from './entities/scenes.entity';
import { ScenesConfigModel } from './models/config.model';
import {
	BulkResultResponseModel,
	SceneActionResponseModel,
	SceneActionsResponseModel,
	SceneExecutionResponseModel,
	SceneResponseModel,
	ScenesResponseModel,
} from './models/scenes-response.model';
import { ActionExecutionResultModel, SceneExecutionResultModel } from './models/scenes.model';

export const SCENES_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	ScenesConfigModel,
	// Response models
	BulkResultResponseModel,
	SceneResponseModel,
	ScenesResponseModel,
	SceneActionResponseModel,
	SceneActionsResponseModel,
	SceneExecutionResponseModel,
	// Data models
	SceneExecutionResultModel,
	ActionExecutionResultModel,
	// Entities
	SceneEntity,
	SceneActionEntity,
];
