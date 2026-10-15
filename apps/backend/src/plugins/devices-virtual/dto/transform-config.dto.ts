import { Expose, Transform, Type } from 'class-transformer';
import {
	Allow,
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	Validate,
	ValidateNested,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import {
	VirtualNumericTransformConfig,
	VirtualNumericTransformOperator,
	validateVirtualNumericTransform,
} from '../services/virtual-numeric-transform.utils';
import { isTransformQuantity, isTransformUnit } from '../services/virtual-transform-contract.utils';
import { VirtualTransformResolver } from '../services/virtual-transform-resolver';

import { VirtualAggregateInputDto } from './producer-config.dto';

@ValidatorConstraint({ name: 'numericTransformPolicy', async: false })
export class NumericTransformPolicyConstraint implements ValidatorConstraintInterface {
	validate(value: VirtualNumericTransformConfig): boolean {
		return value?.operator === VirtualNumericTransformOperator.EXTENSION
			? new VirtualTransformResolver().validate(value).every((error) => error === 'operator_unavailable')
			: validateVirtualNumericTransform(value).length === 0;
	}
	defaultMessage(): string {
		return 'Invalid numeric transform policy';
	}
}

@ValidatorConstraint({ name: 'transformUnit', async: false })
export class TransformUnitConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isTransformUnit(value);
	}
	defaultMessage(): string {
		return 'Transform unit must be bounded printable measurement text';
	}
}

@ValidatorConstraint({ name: 'transformQuantity', async: false })
export class TransformQuantityConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isTransformQuantity(value);
	}
	defaultMessage(): string {
		return 'Transform quantity must be a bounded lowercase identifier';
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginNumericRange' })
export class VirtualNumericRangeDto {
	@ApiProperty({ description: 'Inclusive finite lower bound' })
	@Expose()
	@IsNumber()
	minimum: number;

	@ApiProperty({ description: 'Inclusive finite upper bound' })
	@Expose()
	@IsNumber()
	maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginCalibrationPoint' })
export class VirtualCalibrationPointDto {
	@ApiProperty({ description: 'Input coordinate' })
	@Expose()
	@IsNumber()
	x: number;

	@ApiProperty({ description: 'Output coordinate' })
	@Expose()
	@IsNumber()
	y: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginNumericTransformPolicy' })
export class VirtualNumericTransformPolicyDto {
	@ApiProperty({
		description: 'Whitelisted conversion operator',
		enum: Object.values(VirtualNumericTransformOperator).filter(
			(operator) => operator !== VirtualNumericTransformOperator.EXTENSION,
		),
	})
	@Expose()
	@IsEnum(VirtualNumericTransformOperator)
	operator: VirtualNumericTransformOperator;

	@ApiProperty({ description: 'Explicit input domain', type: VirtualNumericRangeDto })
	@Expose()
	@ValidateNested()
	@Type(() => VirtualNumericRangeDto)
	inputRange: VirtualNumericRangeDto;

	@ApiProperty({ description: 'Explicit output domain', type: VirtualNumericRangeDto })
	@Expose()
	@ValidateNested()
	@Type(() => VirtualNumericRangeDto)
	outputRange: VirtualNumericRangeDto;

	@ApiPropertyOptional({ description: 'Affine scale' })
	@Expose()
	@IsOptional()
	@IsNumber()
	scale?: number;

	@ApiPropertyOptional({ description: 'Affine offset' })
	@Expose()
	@IsOptional()
	@IsNumber()
	offset?: number;

	@ApiPropertyOptional({ description: 'Divider supply voltage in volts' })
	@Expose()
	@IsOptional()
	@IsNumber()
	referenceVoltage?: number;

	@ApiPropertyOptional({ description: 'Fixed series resistance in ohms' })
	@Expose()
	@IsOptional()
	@IsNumber()
	seriesResistance?: number;

	@ApiPropertyOptional({ description: 'Probe nominal resistance in ohms' })
	@Expose()
	@IsOptional()
	@IsNumber()
	nominalResistance?: number;

	@ApiPropertyOptional({ description: 'Probe nominal temperature in Celsius' })
	@Expose()
	@IsOptional()
	@IsNumber()
	nominalTemperatureCelsius?: number;

	@ApiPropertyOptional({ description: 'Probe beta in kelvin' })
	@Expose()
	@IsOptional()
	@IsNumber()
	beta?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart A coefficient in inverse kelvin' })
	@Expose()
	@IsOptional()
	@IsNumber()
	coefficientA?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart B coefficient in inverse kelvin' })
	@Expose()
	@IsOptional()
	@IsNumber()
	coefficientB?: number;

	@ApiPropertyOptional({ description: 'Steinhart-Hart C coefficient in inverse kelvin' })
	@Expose()
	@IsOptional()
	@IsNumber()
	coefficientC?: number;

	@ApiPropertyOptional({
		description: 'Strictly ordered calibration coordinates',
		type: [VirtualCalibrationPointDto],
		minItems: 2,
		maxItems: 256,
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(256)
	@ValidateNested({ each: true })
	@Type(() => VirtualCalibrationPointDto)
	points?: VirtualCalibrationPointDto[];

	@ApiPropertyOptional({
		description: 'Thermistor divider leg: low to ground or high to supply',
		enum: ['low', 'high'],
	})
	@Expose()
	@IsOptional()
	@IsIn(['low', 'high'])
	thermistorLeg?: 'low' | 'high';
}

@ApiSchema({ name: 'DevicesVirtualPluginAffineTransformPolicy' })
export class VirtualAffineTransformPolicyDto extends VirtualNumericTransformPolicyDto {
	@ApiProperty({ description: 'Exact built-in wire operator', enum: [VirtualNumericTransformOperator.AFFINE] })
	@Expose()
	@IsIn([VirtualNumericTransformOperator.AFFINE])
	declare operator: VirtualNumericTransformOperator.AFFINE;
}

@ApiSchema({ name: 'DevicesVirtualPluginPiecewiseLinearTransformPolicy' })
export class VirtualPiecewiseLinearTransformPolicyDto extends VirtualNumericTransformPolicyDto {
	@ApiProperty({
		description: 'Exact built-in wire operator',
		enum: [VirtualNumericTransformOperator.PIECEWISE_LINEAR],
	})
	@Expose()
	@IsIn([VirtualNumericTransformOperator.PIECEWISE_LINEAR])
	declare operator: VirtualNumericTransformOperator.PIECEWISE_LINEAR;
}

@ApiSchema({ name: 'DevicesVirtualPluginNtcBetaTransformPolicy' })
export class VirtualNtcBetaTransformPolicyDto extends VirtualNumericTransformPolicyDto {
	@ApiProperty({ description: 'Exact built-in wire operator', enum: [VirtualNumericTransformOperator.NTC_BETA] })
	@Expose()
	@IsIn([VirtualNumericTransformOperator.NTC_BETA])
	declare operator: VirtualNumericTransformOperator.NTC_BETA;
}

@ApiSchema({ name: 'DevicesVirtualPluginSteinhartHartTransformPolicy' })
export class VirtualSteinhartHartTransformPolicyDto extends VirtualNumericTransformPolicyDto {
	@ApiProperty({ description: 'Exact built-in wire operator', enum: [VirtualNumericTransformOperator.STEINHART_HART] })
	@Expose()
	@IsIn([VirtualNumericTransformOperator.STEINHART_HART])
	declare operator: VirtualNumericTransformOperator.STEINHART_HART;
}

@ApiSchema({ name: 'DevicesVirtualPluginExtensionTransformPolicy' })
export class VirtualExtensionTransformPolicyDto {
	@ApiProperty({ description: 'Trusted package operator', enum: ['extension'] })
	@Expose()
	@IsIn(['extension'])
	operator: VirtualNumericTransformOperator.EXTENSION;
	@ApiProperty({ description: 'SDK contract version', enum: [1] })
	@Expose()
	@IsIn([1])
	contractVersion: 1;
	@ApiProperty({ description: 'Host package qualified local name', maxLength: 280 })
	@Expose()
	@IsString()
	operatorId: string;
	@ApiProperty({ description: 'Exact immutable operator version', minimum: 1 })
	@Expose()
	@IsInt()
	@Min(1)
	operatorVersion: number;
	@ApiProperty({ description: 'Inclusive supported input domain', type: VirtualNumericRangeDto })
	@Expose()
	@Type(() => VirtualNumericRangeDto)
	@ValidateNested()
	inputRange: VirtualNumericRangeDto;
	@ApiProperty({ description: 'Inclusive supported output domain', type: VirtualNumericRangeDto })
	@Expose()
	@Type(() => VirtualNumericRangeDto)
	@ValidateNested()
	outputRange: VirtualNumericRangeDto;
	@ApiProperty({
		description: 'Finite numeric parameters validated against the registered descriptor',
		type: 'object',
		additionalProperties: { type: 'number' },
	})
	@Expose()
	@Allow()
	@Transform(({ obj }: { obj: { parameters: Record<string, number> } }) => obj.parameters)
	parameters: Readonly<Record<string, number>>;
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureTransform' })
export class ConfigureVirtualTransformDto {
	@ApiProperty({ name: 'schema_version', description: 'Policy schema version', enum: [1] })
	@Expose({ name: 'schema_version' })
	@IsIn([1])
	schemaVersion: 1;

	@ApiProperty({
		name: 'expected_revision',
		description: 'Expected configuration revision; zero for new configuration',
		minimum: 0,
	})
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(0)
	expectedRevision: number;

	@ApiPropertyOptional({ name: 'expected_graph_revision', description: 'Dependency graph revision fence', minimum: 0 })
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;

	@ApiProperty({
		name: 'maximum_age_seconds',
		description: 'Maximum original source sample age',
		minimum: 1,
		maximum: 86400,
	})
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(1)
	@Max(86400)
	maximumAgeSeconds: number;

	@ApiProperty({ description: 'Explicit output measurement quantity', maxLength: 64 })
	@Expose()
	@IsString()
	@Validate(TransformQuantityConstraint)
	quantity: string;

	@ApiProperty({ description: 'Explicit output unit', maxLength: 32 })
	@Expose()
	@IsString()
	@Validate(TransformUnitConstraint)
	unit: string;

	@ApiProperty({ description: 'One physical source binding', type: VirtualAggregateInputDto })
	@Expose()
	@ValidateNested()
	@Type(() => VirtualAggregateInputDto)
	source: VirtualAggregateInputDto;

	@ApiProperty({
		description: 'Bounded typed conversion parameters',
		oneOf: [
			{ $ref: getSchemaPath(VirtualAffineTransformPolicyDto) },
			{ $ref: getSchemaPath(VirtualPiecewiseLinearTransformPolicyDto) },
			{ $ref: getSchemaPath(VirtualNtcBetaTransformPolicyDto) },
			{ $ref: getSchemaPath(VirtualSteinhartHartTransformPolicyDto) },
			{ $ref: getSchemaPath(VirtualExtensionTransformPolicyDto) },
		],
		discriminator: {
			propertyName: 'operator',
			mapping: {
				affine: getSchemaPath(VirtualAffineTransformPolicyDto),
				piecewise_linear: getSchemaPath(VirtualPiecewiseLinearTransformPolicyDto),
				ntc_beta: getSchemaPath(VirtualNtcBetaTransformPolicyDto),
				steinhart_hart: getSchemaPath(VirtualSteinhartHartTransformPolicyDto),
				extension: getSchemaPath(VirtualExtensionTransformPolicyDto),
			},
		},
	})
	@Expose()
	@ValidateNested()
	@Validate(NumericTransformPolicyConstraint)
	@Type(() => VirtualNumericTransformPolicyDto, {
		discriminator: {
			property: 'operator',
			subTypes: [
				{ name: 'extension', value: VirtualExtensionTransformPolicyDto },
				{ name: 'affine', value: VirtualAffineTransformPolicyDto },
				{ name: 'piecewise_linear', value: VirtualPiecewiseLinearTransformPolicyDto },
				{ name: 'ntc_beta', value: VirtualNtcBetaTransformPolicyDto },
				{ name: 'steinhart_hart', value: VirtualSteinhartHartTransformPolicyDto },
			],
		},
		keepDiscriminatorProperty: true,
	})
	policy: VirtualNumericTransformPolicyDto | VirtualExtensionTransformPolicyDto;
}
