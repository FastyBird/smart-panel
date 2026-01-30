import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { SecurityStatusModel } from './security-status.model';

@ApiSchema({ name: 'SecurityModuleResStatus' })
export class SecurityStatusResponseModel extends BaseSuccessResponseModel<SecurityStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SecurityStatusModel,
	})
	@Expose()
	declare data: SecurityStatusModel;
}
