import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { BulkResultModel } from '../../api/models/bulk.model';

import { ExtensionModel } from './extension.model';

@ApiSchema({ name: 'ExtensionsModuleResExtensions' })
export class ExtensionsResponseModel extends BaseSuccessResponseModel<ExtensionModel[]> {
	@ApiProperty({
		description: 'The list of extensions',
		type: 'array',
		items: {
			$ref: getSchemaPath(ExtensionModel),
		},
	})
	@Expose()
	@Type(() => ExtensionModel)
	declare data: ExtensionModel[];
}

@ApiSchema({ name: 'ExtensionsModuleResExtension' })
export class ExtensionResponseModel extends BaseSuccessResponseModel<ExtensionModel> {
	@ApiProperty({
		description: 'The extension data',
		type: () => ExtensionModel,
	})
	@Expose()
	@Type(() => ExtensionModel)
	declare data: ExtensionModel;
}

/**
 * Response wrapper for the outcome of a bulk operation
 */
@ApiSchema({ name: 'ExtensionsModuleResBulkResult' })
export class BulkResultResponseModel extends BaseSuccessResponseModel<BulkResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BulkResultModel,
	})
	@Expose()
	declare data: BulkResultModel;
}
