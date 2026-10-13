import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	VirtualNumericTransformConfig,
	VirtualNumericTransformOperator,
} from '../services/virtual-numeric-transform.utils';

@ApiSchema({ name: 'DevicesVirtualPluginDataNumericRange' })
export class VirtualNumericRangeModel {
	@ApiProperty({ description: 'Inclusive lower bound' })
	@Expose()
	minimum: number;

	@ApiProperty({ description: 'Inclusive upper bound' })
	@Expose()
	maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataCalibrationPoint' })
export class VirtualCalibrationPointModel {
	@ApiProperty({ description: 'Input coordinate' })
	@Expose()
	x: number;

	@ApiProperty({ description: 'Output coordinate' })
	@Expose()
	y: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataNumericTransformPolicy' })
export class VirtualNumericTransformPolicyModel {
	@ApiProperty({ description: 'Whitelisted operator', enum: VirtualNumericTransformOperator })
	@Expose()
	operator: VirtualNumericTransformOperator;

	@ApiProperty({ description: 'Input domain', type: VirtualNumericRangeModel })
	@Expose()
	@Type(() => VirtualNumericRangeModel)
	inputRange: VirtualNumericRangeModel;

	@ApiProperty({ description: 'Output domain', type: VirtualNumericRangeModel })
	@Expose()
	@Type(() => VirtualNumericRangeModel)
	outputRange: VirtualNumericRangeModel;

	@ApiPropertyOptional({ description: 'Affine scale' })
	@Expose()
	scale?: number;

	@ApiPropertyOptional({ description: 'Affine offset' })
	@Expose()
	offset?: number;

	@ApiPropertyOptional({ description: 'Divider supply voltage in volts' })
	@Expose()
	referenceVoltage?: number;

	@ApiPropertyOptional({ description: 'Series resistance in ohms' })
	@Expose()
	seriesResistance?: number;

	@ApiPropertyOptional({ description: 'Nominal probe resistance in ohms' })
	@Expose()
	nominalResistance?: number;

	@ApiPropertyOptional({ description: 'Nominal probe temperature in Celsius' })
	@Expose()
	nominalTemperatureCelsius?: number;

	@ApiPropertyOptional({ description: 'Beta constant in kelvin' })
	@Expose()
	beta?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart A coefficient in inverse kelvin' })
	@Expose()
	coefficientA?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart B coefficient in inverse kelvin' })
	@Expose()
	coefficientB?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart C coefficient in inverse kelvin' })
	@Expose()
	coefficientC?: number;

	@ApiPropertyOptional({ description: 'Thermistor divider orientation', enum: ['low', 'high'] })
	@Expose()
	thermistorLeg?: 'low' | 'high';

	@ApiPropertyOptional({ description: 'Ordered calibration coordinates', type: [VirtualCalibrationPointModel] })
	@Expose()
	@Type(() => VirtualCalibrationPointModel)
	points?: VirtualCalibrationPointModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataTransformSource' })
export class VirtualTransformSourceModel {
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
		description: 'Stable source or conversion exclusion code',
		type: String,
		nullable: true,
	})
	@Expose()
	exclusion?: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataTransformPreview' })
export class VirtualTransformPreviewModel {
	@ApiProperty({ description: 'Hypothetical input value' })
	@Expose()
	input: number;

	@ApiProperty({ description: 'Computed hypothetical output', type: Number, nullable: true })
	@Expose()
	value: number | null;

	@ApiProperty({ description: 'Conversion failure code', type: String, nullable: true })
	@Expose()
	error: string | null;

	@ApiProperty({
		description: 'Preview cannot establish measurement qualification',
		type: Boolean,
		default: false,
		readOnly: true,
	})
	@Expose()
	qualified: false;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataTransformConfiguration' })
export class VirtualTransformConfigurationModel {
	@ApiPropertyOptional({
		name: 'preview_result',
		description: 'Hypothetical conversion result; never a live reading',
		type: VirtualTransformPreviewModel,
	})
	@Expose()
	@Type(() => VirtualTransformPreviewModel)
	preview_result?: VirtualTransformPreviewModel;

	@ApiProperty({ description: 'Stable materialized output property UUID', format: 'uuid' })
	@Expose()
	output_property: string;

	@ApiProperty({ description: 'Policy schema version', enum: [1] })
	@Expose()
	schema_version: number;

	@ApiProperty({ description: 'Configuration revision' })
	@Expose()
	revision: number;

	@ApiProperty({ description: 'Dependency graph revision' })
	@Expose()
	graph_revision: number;

	@ApiProperty({ description: 'Maximum original sample age in seconds' })
	@Expose()
	maximum_age_seconds: number;

	@ApiProperty({ description: 'Output measurement quantity' })
	@Expose()
	quantity: string;

	@ApiProperty({ description: 'Output measurement unit' })
	@Expose()
	unit: string;

	@ApiProperty({ description: 'Bounded typed policy', type: VirtualNumericTransformPolicyModel })
	@Expose()
	@Type(() => VirtualNumericTransformPolicyModel)
	policy: VirtualNumericTransformConfig;

	@ApiProperty({ description: 'Source binding and diagnostics', type: VirtualTransformSourceModel })
	@Expose()
	@Type(() => VirtualTransformSourceModel)
	source: VirtualTransformSourceModel;

	@ApiProperty({ description: 'Availability of evaluator in this process', enum: ['ready', 'unavailable'] })
	@Expose()
	runtime_readiness: 'ready' | 'unavailable';

	@ApiProperty({ description: 'Current output value, never a last-good fallback', type: Number, nullable: true })
	@Expose()
	current_value: number | null;

	@ApiProperty({ description: 'Current measurement quality', enum: ['good', 'unavailable'] })
	@Expose()
	quality: 'good' | 'unavailable';

	@ApiProperty({ description: 'Stable exclusion or conversion error codes', type: [String] })
	@Expose()
	errors: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResTransformConfiguration' })
export class VirtualTransformConfigurationResponseModel extends BaseSuccessResponseModel<VirtualTransformConfigurationModel> {
	@ApiProperty({
		description: 'Numeric transform configuration',
		type: 'object',
		additionalProperties: false,
		allOf: [{ $ref: getSchemaPath(VirtualTransformConfigurationModel) }],
	})
	@Expose()
	@Type(() => VirtualTransformConfigurationModel)
	declare data: VirtualTransformConfigurationModel;
}
