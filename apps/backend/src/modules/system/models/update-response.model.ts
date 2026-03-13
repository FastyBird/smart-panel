import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { UpdateInfoModel, UpdateStatusModel } from './update.model';

/**
 * Response wrapper for UpdateInfoModel
 */
@ApiSchema({ name: 'SystemModuleResUpdateInfo' })
export class UpdateInfoResponseModel extends BaseSuccessResponseModel<UpdateInfoModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => UpdateInfoModel,
	})
	@Expose()
	declare data: UpdateInfoModel;
}

/**
 * Response wrapper for UpdateStatusModel
 */
@ApiSchema({ name: 'SystemModuleResUpdateStatus' })
export class UpdateStatusResponseModel extends BaseSuccessResponseModel<UpdateStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => UpdateStatusModel,
	})
	@Expose()
	declare data: UpdateStatusModel;
}
