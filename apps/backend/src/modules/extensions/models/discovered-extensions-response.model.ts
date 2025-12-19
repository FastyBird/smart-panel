import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import {
	DiscoveredExtensionAdminModel,
	DiscoveredExtensionBackendModel,
	DiscoveredExtensionBaseModel,
} from './discovered-extension.model';

@ApiSchema({ name: 'ExtensionsModuleResDiscoveredExtensions' })
export class DiscoveredExtensionsResponseModel extends BaseSuccessResponseModel<DiscoveredExtensionBaseModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: {
			oneOf: [
				{ $ref: getSchemaPath(DiscoveredExtensionAdminModel) },
				{ $ref: getSchemaPath(DiscoveredExtensionBackendModel) },
			],
			discriminator: {
				propertyName: 'type',
				mapping: {
					admin: getSchemaPath(DiscoveredExtensionAdminModel),
					backend: getSchemaPath(DiscoveredExtensionBackendModel),
				},
			},
		},
	})
	@Expose()
	declare data: DiscoveredExtensionBaseModel[];
}
