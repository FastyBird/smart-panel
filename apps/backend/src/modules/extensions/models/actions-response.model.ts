import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { ActionExecutionRecordModel, ActionResultModel, ExtensionActionModel } from './action.model';

@ApiSchema({ name: 'ExtensionsModuleResActions' })
export class ExtensionActionsResponseModel extends BaseSuccessResponseModel<ExtensionActionModel[]> {
	@ApiProperty({
		description: 'The list of available actions',
		type: 'array',
		items: {
			$ref: getSchemaPath(ExtensionActionModel),
		},
	})
	@Expose()
	@Type(() => ExtensionActionModel)
	declare data: ExtensionActionModel[];
}

@ApiSchema({ name: 'ExtensionsModuleResActionResult' })
export class ActionResultResponseModel extends BaseSuccessResponseModel<ActionResultModel> {
	@ApiProperty({
		description: 'The action execution result',
		type: () => ActionResultModel,
	})
	@Expose()
	@Type(() => ActionResultModel)
	declare data: ActionResultModel;
}

@ApiSchema({ name: 'ExtensionsModuleResActionHistory' })
export class ActionHistoryResponseModel extends BaseSuccessResponseModel<ActionExecutionRecordModel[]> {
	@ApiProperty({
		description: 'Recent action execution records',
		type: 'array',
		items: {
			$ref: getSchemaPath(ActionExecutionRecordModel),
		},
	})
	@Expose()
	@Type(() => ActionExecutionRecordModel)
	declare data: ActionExecutionRecordModel[];
}
