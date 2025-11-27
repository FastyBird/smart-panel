import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import { ThirdPartyDemoControlModel } from './demo-control.model';

/**
 * Response wrapper for ThirdPartyDemoControlModel
 */
@ApiSchema({ name: 'DevicesThirdPartyPluginResDemoControl' })
export class DemoControlResponseModel extends BaseSuccessResponseModel<ThirdPartyDemoControlModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ThirdPartyDemoControlModel,
	})
	@Expose()
	declare data: ThirdPartyDemoControlModel;
}
