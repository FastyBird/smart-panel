import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SceneActionEntity, SceneEntity } from '../entities/scenes.entity';

import { SceneExecutionResultModel } from './scenes.model';

/**
 * Response wrapper for SceneEntity
 */
@ApiSchema({ name: 'ScenesModuleResScene' })
export class SceneResponseModel extends BaseSuccessResponseModel<SceneEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SceneEntity,
	})
	@Expose()
	declare data: SceneEntity;
}

/**
 * Response wrapper for array of SceneEntity
 */
@ApiSchema({ name: 'ScenesModuleResScenes' })
export class ScenesResponseModel extends BaseSuccessResponseModel<SceneEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(SceneEntity) },
	})
	@Expose()
	declare data: SceneEntity[];
}

/**
 * Response wrapper for SceneActionEntity
 */
@ApiSchema({ name: 'ScenesModuleResSceneAction' })
export class SceneActionResponseModel extends BaseSuccessResponseModel<SceneActionEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SceneActionEntity,
	})
	@Expose()
	declare data: SceneActionEntity;
}

/**
 * Response wrapper for array of SceneActionEntity
 */
@ApiSchema({ name: 'ScenesModuleResSceneActions' })
export class SceneActionsResponseModel extends BaseSuccessResponseModel<SceneActionEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(SceneActionEntity) },
	})
	@Expose()
	declare data: SceneActionEntity[];
}

/**
 * Response wrapper for scene execution result
 */
@ApiSchema({ name: 'ScenesModuleResSceneExecution' })
export class SceneExecutionResponseModel extends BaseSuccessResponseModel<SceneExecutionResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SceneExecutionResultModel,
	})
	@Expose()
	declare data: SceneExecutionResultModel;
}
