import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	VirtualNumericTransformConfig,
	VirtualNumericTransformOperator,
} from '../services/virtual-numeric-transform.utils';

import { VirtualProducerBindingModel } from './producer-response.model';

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

	@ApiPropertyOptional({ description: 'Thermistor divider orientation', enum: ['low', 'high'] })
	@Expose()
	thermistorLeg?: 'low' | 'high';

	@ApiPropertyOptional({ description: 'Ordered calibration coordinates', type: [VirtualCalibrationPointModel] })
	@Expose()
	@Type(() => VirtualCalibrationPointModel)
	points?: VirtualCalibrationPointModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataTransformConfiguration' })
export class VirtualTransformConfigurationModel {
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

	@ApiProperty({ description: 'Source binding and diagnostics', type: VirtualProducerBindingModel })
	@Expose()
	@Type(() => VirtualProducerBindingModel)
	source: VirtualProducerBindingModel;

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
