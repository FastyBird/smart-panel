/**
 * OpenAPI extra models for Scenes module
 */
import { SceneActionEntity, SceneConditionEntity, SceneEntity, SceneTriggerEntity } from './entities/scenes.entity';
import {
	SceneActionResponseModel,
	SceneActionsResponseModel,
	SceneConditionResponseModel,
	SceneConditionsResponseModel,
	SceneExecutionResponseModel,
	SceneResponseModel,
	SceneTriggerResponseModel,
	SceneTriggersResponseModel,
	ScenesResponseModel,
} from './models/scenes-response.model';
import { ActionExecutionResultModel, SceneExecutionResultModel } from './models/scenes.model';

export const SCENES_SWAGGER_EXTRA_MODELS = [
	// Response models
	SceneResponseModel,
	ScenesResponseModel,
	SceneActionResponseModel,
	SceneActionsResponseModel,
	SceneConditionResponseModel,
	SceneConditionsResponseModel,
	SceneTriggerResponseModel,
	SceneTriggersResponseModel,
	SceneExecutionResponseModel,
	// Data models
	SceneExecutionResultModel,
	ActionExecutionResultModel,
	// Entities
	SceneEntity,
	SceneActionEntity,
	SceneConditionEntity,
	SceneTriggerEntity,
];
