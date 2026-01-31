import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

@ApiSchema({ name: 'SecurityModuleDataAlertAck' })
export class SecurityAlertAckModel {
	@ApiProperty({
		description: 'The alert ID that was acknowledged',
		type: 'string',
		example: 'sensor:dev_123:smoke',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Whether the alert is acknowledged',
		type: 'boolean',
		example: true,
	})
	@Expose()
	acknowledged: boolean;
}

@ApiSchema({ name: 'SecurityModuleResAlertAck' })
export class SecurityAlertAckResponseModel extends BaseSuccessResponseModel<SecurityAlertAckModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SecurityAlertAckModel,
	})
	@Expose()
	declare data: SecurityAlertAckModel;
}

@ApiSchema({ name: 'SecurityModuleResAlertAckAll' })
export class SecurityAlertAckAllResponseModel extends BaseSuccessResponseModel<SecurityAlertAckModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => [SecurityAlertAckModel],
	})
	@Expose()
	declare data: SecurityAlertAckModel[];
}
