import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { PropertyUpdateResultModel } from '../dto/third-party-property-update-response.dto';

/**
 * Response model for 207 Multi-Status response
 * This is a raw response (not wrapped in BaseSuccessResponseModel) for third-party device updates
 * Note: This does not extend BaseSuccessResponseModel because it's used for raw 207 responses
 */
@ApiSchema({ name: 'DevicesThirdPartyPluginPropertiesUpdateResult' })
export class PropertiesUpdateResultResponseModel {
	@ApiProperty({
		description: 'Array of property update results',
		type: 'array',
		items: { $ref: getSchemaPath(PropertyUpdateResultModel) },
	})
	@Expose()
	@Type(() => PropertyUpdateResultModel)
	properties: PropertyUpdateResultModel[];
}
