import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
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

	@ApiPropertyOptional({ description: 'Current source numeric value', type: Number, nullable: true })
	@Expose()
	current_value?: number | null;

	@ApiPropertyOptional({
		description: 'Original source sample timestamp',
		type: String,
		format: 'date-time',
		nullable: true,
	})
	@Expose()
	sampled_at?: string | null;

	@ApiPropertyOptional({ description: 'Sample age at evaluation in seconds', type: Number, nullable: true })
	@Expose()
	age_seconds?: number | null;

	@ApiPropertyOptional({
		description: 'Reason input was excluded',
		enum: ['missing', 'incompatible', 'offline', 'invalid', 'stale', 'disabled'],
		nullable: true,
	})
	@Expose()
	exclusion?: string | null;
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
		description: 'Aggregate runtime availability in this process; live quality is exposed on the output property',
		enum: ['ready', 'unavailable'],
	})
	@Expose()
	runtime_readiness: 'ready' | 'unavailable';

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

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupReportedProperty' })
export class VirtualLightGroupReportedPropertyModel {
	@ApiProperty({ enum: PropertyCategory })
	@Expose()
	category: PropertyCategory;

	@ApiProperty({
		oneOf: [{ type: 'number' }, { type: 'boolean' }],
		nullable: true,
		description: 'Feedback representative; brightness is the raw mean of valid on members',
	})
	@Expose()
	value: number | boolean | null;

	@ApiPropertyOptional({
		oneOf: [{ type: 'number' }, { type: 'boolean' }],
		description: 'Published representative rounded onto the validated output grid',
	})
	@Expose()
	representative_value?: number | boolean;

	@ApiPropertyOptional({ description: 'Raw representative needed rounding onto the output grid' })
	@Expose()
	rounded?: boolean;

	@ApiProperty({ description: 'Contributors disagree outside documented native-unit tolerance' })
	@Expose()
	mixed: boolean;

	@ApiProperty({ type: [String], description: 'Actual contributing physical channel identities' })
	@Expose()
	contributors: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupReportedMember' })
export class VirtualLightGroupReportedMemberModel {
	@ApiProperty({ description: 'Intended physical channel identity retained after deletion' })
	@Expose()
	source_identity: string;

	@ApiProperty({ type: 'boolean', nullable: true })
	@Expose()
	on: boolean | null;

	@ApiProperty({
		type: [String],
		description: 'Missing, disabled, offline, incompatible or absent fresh provider evidence',
	})
	@Expose()
	reasons: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupReportedState' })
export class VirtualLightGroupReportedStateModel {
	@ApiProperty({
		type: 'boolean',
		nullable: true,
		description: 'Three-valued any-on; null when no on member and some unknown',
	})
	@Expose()
	on: boolean | null;

	@ApiProperty({ type: 'boolean', nullable: true })
	@Expose()
	all_on: boolean | null;

	@ApiProperty()
	@Expose()
	mixed: boolean;

	@ApiProperty({ description: 'Every configured member, including missing identities' })
	@Expose()
	total: number;

	@ApiProperty()
	@Expose()
	on_count: number;

	@ApiProperty()
	@Expose()
	off_count: number;

	@ApiProperty()
	@Expose()
	unknown_count: number;

	@ApiProperty({ type: [VirtualLightGroupReportedMemberModel] })
	@Expose()
	@Type(() => VirtualLightGroupReportedMemberModel)
	members: VirtualLightGroupReportedMemberModel[];

	@ApiProperty({ type: [VirtualLightGroupReportedPropertyModel] })
	@Expose()
	@Type(() => VirtualLightGroupReportedPropertyModel)
	properties: VirtualLightGroupReportedPropertyModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupCapability' })
export class VirtualLightGroupCapabilityModel {
	@ApiProperty({ enum: PropertyCategory })
	@Expose()
	category: PropertyCategory;

	@ApiProperty({ enum: DataTypeType })
	@Expose()
	data_type: DataTypeType;

	@ApiProperty({ type: 'string', nullable: true })
	@Expose()
	unit: string | null;

	@ApiProperty({
		oneOf: [
			{ type: 'array', items: { type: 'number' } },
			{ type: 'array', items: { type: 'string' } },
		],
		nullable: true,
	})
	@Expose()
	format: number[] | string[] | null;

	@ApiProperty({ type: 'number', nullable: true })
	@Expose()
	step: number | null;
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
		description: 'Configured group runtime is implemented; reported quality remains separate',
		enum: ['ready'],
	})
	@Expose()
	runtime_readiness: 'ready';

	@ApiProperty({
		type: [VirtualLightGroupCapabilityModel],
		description: 'Intersection across intended members; missing members retain the last validated exposed contract',
	})
	@Expose()
	@Type(() => VirtualLightGroupCapabilityModel)
	common_capabilities: VirtualLightGroupCapabilityModel[];

	@ApiPropertyOptional({ allOf: [{ $ref: getSchemaPath(VirtualLightGroupReportedStateModel) }], nullable: true })
	@Expose()
	@Type(() => VirtualLightGroupReportedStateModel)
	reported_state?: VirtualLightGroupReportedStateModel | null;

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
