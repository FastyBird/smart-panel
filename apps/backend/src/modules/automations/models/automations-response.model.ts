import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationSummaryModel } from './automations.model';
import { AutomationGraphValidationModel } from './graph-validation.model';
import { AutomationNodeTypeModel } from './node-types.model';

/**
 * Response wrapper for AutomationEntity
 */
@ApiSchema({ name: 'AutomationsModuleResAutomation' })
export class AutomationResponseModel extends BaseSuccessResponseModel<AutomationEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => AutomationEntity,
	})
	@Expose()
	declare data: AutomationEntity;
}

/**
 * Response wrapper for array of AutomationSummaryModel
 */
@ApiSchema({ name: 'AutomationsModuleResAutomations' })
export class AutomationsResponseModel extends BaseSuccessResponseModel<AutomationSummaryModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationSummaryModel) },
	})
	@Expose()
	declare data: AutomationSummaryModel[];
}

/**
 * Response wrapper for AutomationGraphValidationModel
 */
@ApiSchema({ name: 'AutomationsModuleResGraphValidation' })
export class AutomationGraphValidationResponseModel extends BaseSuccessResponseModel<AutomationGraphValidationModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => AutomationGraphValidationModel,
	})
	@Expose()
	declare data: AutomationGraphValidationModel;
}

/**
 * Response wrapper for array of AutomationNodeTypeModel
 */
@ApiSchema({ name: 'AutomationsModuleResNodeTypes' })
export class AutomationNodeTypesResponseModel extends BaseSuccessResponseModel<AutomationNodeTypeModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationNodeTypeModel) },
	})
	@Expose()
	declare data: AutomationNodeTypeModel[];
}
