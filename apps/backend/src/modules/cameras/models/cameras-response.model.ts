import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { CameraModel } from './camera.model';
import { CameraSessionModel } from './session.model';

/**
 * Response wrapper for CameraModel
 */
@ApiSchema({ name: 'CamerasModuleResCamera' })
export class CameraResponseModel extends BaseSuccessResponseModel<CameraModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CameraModel,
	})
	@Expose()
	declare data: CameraModel;
}

/**
 * Response wrapper for array of CameraModel
 */
@ApiSchema({ name: 'CamerasModuleResCameras' })
export class CamerasResponseModel extends BaseSuccessResponseModel<CameraModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(CameraModel) },
	})
	@Expose()
	declare data: CameraModel[];
}

/**
 * Response wrapper for CameraSessionModel
 */
@ApiSchema({ name: 'CamerasModuleResSession' })
export class CameraSessionResponseModel extends BaseSuccessResponseModel<CameraSessionModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CameraSessionModel,
	})
	@Expose()
	declare data: CameraSessionModel;
}
