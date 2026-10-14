import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { CompositeCommandOutcomeModel } from './composite-command.model';

@ApiSchema({ name: 'DevicesModuleDataPropertyCommandTargetResult' })
export class PropertyCommandTargetResultModel {
	@ApiProperty()
	@Expose()
	device: string;

	@ApiPropertyOptional()
	@Expose()
	channel?: string;

	@ApiPropertyOptional()
	@Expose()
	property?: string;

	@ApiProperty()
	@Expose()
	success: boolean;

	@ApiPropertyOptional()
	@Expose()
	reason?: string;
}

@ApiSchema({ name: 'DevicesModuleDataPropertyCommandResult' })
export class PropertyCommandResultModel {
	@ApiProperty({ format: 'uuid' })
	@Expose()
	request_id: string;

	@ApiProperty({
		description: 'True only when all targets succeeded; composite targets require every intended child confirmed',
	})
	@Expose()
	success: boolean;

	@ApiProperty({ type: [PropertyCommandTargetResultModel] })
	@Expose()
	@Type(() => PropertyCommandTargetResultModel)
	results: PropertyCommandTargetResultModel[];

	@ApiProperty({ type: [CompositeCommandOutcomeModel] })
	@Expose()
	@Type(() => CompositeCommandOutcomeModel)
	composites: CompositeCommandOutcomeModel[];
}

@ApiSchema({ name: 'DevicesModuleResPropertyCommand' })
export class PropertyCommandResponseModel extends BaseSuccessResponseModel<PropertyCommandResultModel> {
	@ApiProperty({ type: PropertyCommandResultModel })
	@Expose()
	@Type(() => PropertyCommandResultModel)
	declare data: PropertyCommandResultModel;
}
