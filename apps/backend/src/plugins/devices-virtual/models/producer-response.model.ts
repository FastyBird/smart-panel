import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	VirtualAggregateFilter,
	VirtualAggregateFilterKind,
	VirtualAggregateOperator,
	VirtualAggregateProfile,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';

@ApiSchema({ name: 'DevicesVirtualPluginDataProducerBinding' })
export class VirtualProducerBindingModel {
	@ApiPropertyOptional({
		description: 'Aggregate relative input weight; defaults to 1',
		minimum: 0.000001,
		maximum: 1000000,
	})
	@Expose()
	weight?: number;

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

	@ApiPropertyOptional({
		description: 'Current source value',
		oneOf: [{ type: 'number' }, { type: 'boolean' }],
		nullable: true,
	})
	@Expose()
	current_value?: number | boolean | null;

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
		enum: ['missing', 'incompatible', 'offline', 'invalid', 'stale', 'disabled', 'outlier'],
		nullable: true,
	})
	@Expose()
	exclusion?: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregateOutlierFilter' })
export class VirtualAggregateOutlierFilterModel implements VirtualAggregateFilter {
	@ApiProperty({ enum: VirtualAggregateFilterKind })
	@Expose()
	kind: VirtualAggregateFilterKind;

	@ApiProperty({
		description: 'Absolute deviation threshold in canonical units, equality included',
		minimum: 0,
		exclusiveMinimum: true,
	})
	@Expose()
	threshold: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregatePreview' })
export class VirtualAggregatePreviewModel {
	@ApiProperty({
		type: String,
		format: 'date-time',
		description:
			'Ephemeral evaluation of the proposed policy against qualified live evidence. Does not admit sources for future creation or publish a live reading.',
	})
	@Expose()
	evaluated_at: string;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	@Expose()
	sampled_at: string | null;

	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description: 'Earliest evidence expiry; null for unavailable results. Never extended by reading the preview.',
	})
	@Expose()
	expires_at: string | null;

	@ApiProperty({ enum: VirtualAggregateProfile })
	@Expose()
	profile: VirtualAggregateProfile;

	@ApiProperty({ type: String, nullable: true })
	@Expose()
	unit: string | null;

	@ApiProperty({ type: Number, nullable: true })
	@Expose()
	output_step: number | null;

	@ApiProperty({ oneOf: [{ type: 'number' }, { type: 'boolean' }], nullable: true })
	@Expose()
	value: number | boolean | null;

	@ApiProperty({ enum: ['good', 'degraded', 'unavailable'] })
	@Expose()
	quality: 'good' | 'degraded' | 'unavailable';

	@ApiProperty({ type: [String] })
	@Expose()
	reasons: string[];

	@ApiProperty({
		type: [VirtualProducerBindingModel],
		description:
			'Evaluated draft input diagnostics. Saved runtime diagnostics are returned separately by configuration reads.',
	})
	@Expose()
	@Type(() => VirtualProducerBindingModel)
	inputs: VirtualProducerBindingModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregateConfiguration' })
export class VirtualAggregateConfigurationModel {
	@ApiPropertyOptional({
		type: VirtualAggregatePreviewModel,
		description: 'Present only for preview requests; evaluated draft snapshot, never saved runtime authority.',
	})
	@Expose()
	@Type(() => VirtualAggregatePreviewModel)
	preview_result?: VirtualAggregatePreviewModel;

	@ApiProperty({
		description: 'Exact canonical channel/quantity profile; excludes smoke and leak policy',
		enum: VirtualAggregateProfile,
	})
	@Expose()
	profile: VirtualAggregateProfile;

	@ApiProperty({
		description:
			'Fixed output precision grid; null preserves the legacy temperature declared grid or floating precision',
		type: Number,
		nullable: true,
	})
	@Expose()
	output_step: number | null;

	@ApiProperty({
		description: 'Final numeric rounding policy; binary values are never rounded',
		enum: ['nearest_ties_positive'],
	})
	@Expose()
	rounding: string;

	@ApiProperty({
		description: 'Explicit outlier filter, null when disabled',
		type: VirtualAggregateOutlierFilterModel,
		nullable: true,
	})
	@Expose()
	@Type(() => VirtualAggregateOutlierFilterModel)
	outlier_filter: VirtualAggregateOutlierFilterModel | null;

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
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description:
			'Oldest actual contributing sample; absent for configured metadata and fields with no qualified contributors.',
	})
	@Expose()
	sampled_at?: string;
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'Earliest absolute contributor expiry; reading this report never renews freshness.',
	})
	@Expose()
	expires_at?: string;

	@ApiPropertyOptional({
		enum: ['configured'],
		description: 'Configuration metadata; never a physical sample or timestamp',
	})
	@Expose()
	provenance?: 'configured';

	@ApiProperty({ enum: PropertyCategory })
	@Expose()
	category: PropertyCategory;

	@ApiProperty({
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		description: 'Feedback representative; brightness is the raw mean of valid on members',
	})
	@Expose()
	value: string | number | boolean | null;

	@ApiPropertyOptional({
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		description: 'Published representative rounded onto the validated output grid',
	})
	@Expose()
	representative_value?: string | number | boolean;

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
	@ApiPropertyOptional({
		enum: ['ro', 'rw', 'wo'],
		description: 'Profile field access; legacy light fields are read-write. Materialized outputs remain read-only.',
	})
	@Expose()
	access?: 'ro' | 'rw' | 'wo';

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

@ApiSchema({ name: 'DevicesVirtualPluginDataCoverOperationMemberReadiness' })
export class CoverOperationMemberReadinessModel {
	@ApiProperty({ type: 'string' })
	@Expose()
	source_identity: string;
	@ApiProperty({ type: 'boolean' })
	@Expose()
	commandable: boolean;
	@ApiProperty({ type: [String] })
	@Expose()
	reasons: string[];
}
@ApiSchema({ name: 'DevicesVirtualPluginDataCoverOperationReadiness' })
export class CoverOperationReadinessModel {
	@ApiProperty({ enum: ['open', 'close', 'stop', 'position', 'tilt'] })
	@Expose()
	operation: 'open' | 'close' | 'stop' | 'position' | 'tilt';
	@ApiProperty({ type: 'boolean', description: 'Current adapter readiness; dispatch revalidates every member' })
	@Expose()
	commandable: boolean;
	@ApiProperty({ type: [CoverOperationMemberReadinessModel] })
	@Expose()
	@Type(() => CoverOperationMemberReadinessModel)
	members: CoverOperationMemberReadinessModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupConfiguration' })
export class VirtualLightGroupConfigurationModel {
	@ApiPropertyOptional({
		type: [CoverOperationReadinessModel],
		description: 'Operational cover capabilities, separate from structural field access',
	})
	@Expose()
	@Type(() => CoverOperationReadinessModel)
	operations?: CoverOperationReadinessModel[];

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

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregateProfile' })
export class VirtualAggregateProfileModel {
	@ApiProperty({ enum: VirtualAggregateProfile })
	@Expose()
	profile: VirtualAggregateProfile;

	@ApiProperty({ description: 'Canonical channel; distinguishes contact, motion and occupancy', type: String })
	@Expose()
	channel: string;

	@ApiProperty({ description: 'Canonical property category', enum: PropertyCategory })
	@Expose()
	quantity: PropertyCategory;

	@ApiProperty({ type: String, nullable: true })
	@Expose()
	unit: string | null;

	@ApiProperty({ enum: DataTypeType, isArray: true })
	@Expose()
	data_types: DataTypeType[];

	@ApiProperty({ enum: VirtualAggregateOperator, isArray: true })
	@Expose()
	operators: VirtualAggregateOperator[];

	@ApiProperty({ description: 'Whether weights and numeric outlier filtering are supported' })
	@Expose()
	numeric_policy: boolean;

	@ApiProperty({
		type: Number,
		nullable: true,
		description: 'Fixed grid, or null for legacy declared temperature precision/binary',
	})
	@Expose()
	output_step: number | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginResAggregateProfiles' })
export class VirtualAggregateProfilesResponseModel extends BaseSuccessResponseModel<VirtualAggregateProfileModel[]> {
	@ApiProperty({
		type: [VirtualAggregateProfileModel],
		description: 'Supported profiles only; no generic alarm/security policy',
	})
	@Expose()
	@Type(() => VirtualAggregateProfileModel)
	declare data: VirtualAggregateProfileModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataAggregateSource' })
export class VirtualAggregateSourceModel {
	@ApiProperty({ format: 'uuid' })
	@Expose()
	property: string;

	@ApiProperty({ format: 'uuid' })
	@Expose()
	channel: string;

	@ApiProperty({ format: 'uuid' })
	@Expose()
	device: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginResAggregateSources' })
export class VirtualAggregateSourcesResponseModel extends BaseSuccessResponseModel<VirtualAggregateSourceModel[]> {
	@ApiProperty({
		type: [VirtualAggregateSourceModel],
		description: 'Structurally eligible sources; live freshness is still required at runtime',
	})
	@Expose()
	@Type(() => VirtualAggregateSourceModel)
	declare data: VirtualAggregateSourceModel[];
}
