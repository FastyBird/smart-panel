import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { BackupDataModel } from './backup.model';

/**
 * Response wrapper for a single BackupDataModel
 */
@ApiSchema({ name: 'SystemModuleResBackup' })
export class BackupResponseModel extends BaseSuccessResponseModel<BackupDataModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BackupDataModel,
	})
	@Expose()
	declare data: BackupDataModel;
}

/**
 * Response wrapper for array of BackupDataModel
 */
@ApiSchema({ name: 'SystemModuleResBackups' })
export class BackupsResponseModel extends BaseSuccessResponseModel<BackupDataModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(BackupDataModel) },
	})
	@Expose()
	declare data: BackupDataModel[];
}
