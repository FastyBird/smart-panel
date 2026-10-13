import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { VirtualAggregateOperator, VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

@ApiSchema({ name: 'DevicesVirtualPluginDataProducerBinding' })
export class VirtualProducerBindingModel {
	@ApiProperty({ description: 'Stable binding UUID', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Materialized output UUID', format: 'uuid' })
	@Expose()
	output_property: string;

	@ApiProperty({ description: 'Live source UUID, null when deleted', type: 'string', format: 'uuid', nullable: true })
	@Expose()
	source_property: string | null;

	@ApiProperty({ description: 'Original source UUID retained for diagnostics and repair', format: 'uuid' })
	@Expose()
	source_identity: string;

	@ApiProperty({ description: 'Source quantity at configuration time' })
	@Expose()
	quantity: string;

	@ApiProperty({ description: 'Source unit at configuration time', type: 'string', nullable: true })
	@Expose()
	unit: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregateConfiguration' })
export class VirtualAggregateConfigurationModel {
	@ApiProperty({ description: 'Materialized output UUID', format: 'uuid' })
	@Expose()
	output_property: string;

	@ApiProperty({ description: 'Policy schema version', enum: [1] })
	@Expose()
	schema_version: number;

	@ApiProperty({ description: 'Aggregate operator', enum: VirtualAggregateOperator })
	@Expose()
	operator: VirtualAggregateOperator;

	@ApiProperty({ description: 'Minimum fresh member count' })
	@Expose()
	minimum_valid_inputs: number;

	@ApiProperty({ description: 'Maximum contributing sample age in seconds' })
	@Expose()
	maximum_age_seconds: number;

	@ApiProperty({ description: 'Configuration revision' })
	@Expose()
	revision: number;

	@ApiProperty({ description: 'Authoritative dependency graph revision' })
	@Expose()
	graph_revision: number;

	@ApiProperty({
		description: 'Configuration is durable; runtime evaluation is not delivered at this stage',
		enum: ['unavailable'],
	})
	@Expose()
	runtime_readiness: 'unavailable';

	@ApiProperty({
		description: 'Input diagnostics, including missing member edges',
		type: [VirtualProducerBindingModel],
	})
	@Expose()
	@Type(() => VirtualProducerBindingModel)
	inputs: VirtualProducerBindingModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupMember' })
export class VirtualLightGroupMemberModel {
	@ApiProperty({ description: 'Stable member UUID', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Live physical channel UUID; null when deleted',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose()
	source_channel: string | null;

	@ApiProperty({ description: 'Original physical channel UUID retained for repair', format: 'uuid' })
	@Expose()
	source_identity: string;

	@ApiProperty({
		description: 'Member property bindings, including missing edges',
		type: [VirtualProducerBindingModel],
	})
	@Expose()
	@Type(() => VirtualProducerBindingModel)
	bindings: VirtualProducerBindingModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupConfiguration' })
export class VirtualLightGroupConfigurationModel {
	@ApiProperty({ description: 'Owning group channel UUID', format: 'uuid' })
	@Expose()
	group_channel: string;

	@ApiProperty({ description: 'Policy schema version', enum: [1] })
	@Expose()
	schema_version: number;

	@ApiProperty({ description: 'Light group profile', enum: VirtualLightGroupProfile })
	@Expose()
	profile: VirtualLightGroupProfile;

	@ApiProperty({ description: 'Configuration revision' })
	@Expose()
	revision: number;

	@ApiProperty({ description: 'Authoritative dependency graph revision' })
	@Expose()
	graph_revision: number;

	@ApiProperty({
		description: 'Configuration is durable; group evaluation/commands are not delivered at this stage',
		enum: ['unavailable'],
	})
	@Expose()
	runtime_readiness: 'unavailable';

	@ApiProperty({ description: 'Physical members and bindings', type: [VirtualLightGroupMemberModel] })
	@Expose()
	@Type(() => VirtualLightGroupMemberModel)
	members: VirtualLightGroupMemberModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResAggregateConfiguration' })
export class VirtualAggregateConfigurationResponseModel extends BaseSuccessResponseModel<VirtualAggregateConfigurationModel> {
	@ApiProperty({
		description: 'Aggregate configuration',
		type: 'object',
		additionalProperties: false,
		allOf: [{ $ref: getSchemaPath(VirtualAggregateConfigurationModel) }],
	})
	@Expose()
	@Type(() => VirtualAggregateConfigurationModel)
	declare data: VirtualAggregateConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResLightGroupConfiguration' })
export class VirtualLightGroupConfigurationResponseModel extends BaseSuccessResponseModel<VirtualLightGroupConfigurationModel> {
	@ApiProperty({
		description: 'Light group configuration',
		type: 'object',
		additionalProperties: false,
		allOf: [{ $ref: getSchemaPath(VirtualLightGroupConfigurationModel) }],
	})
	@Expose()
	@Type(() => VirtualLightGroupConfigurationModel)
	declare data: VirtualLightGroupConfigurationModel;
}
