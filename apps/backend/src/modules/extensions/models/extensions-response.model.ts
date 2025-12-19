import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

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
