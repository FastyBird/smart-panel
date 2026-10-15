import { Expose, Transform, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import { VirtualNumericRangeModel } from './transform-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataNumericMeasurement' })
export class NumericMeasurementModel {
	@ApiProperty({ description: 'Exact canonical measurement quantity' }) @Expose() quantity: string;
	@ApiProperty({ description: 'Exact canonical measurement unit' }) @Expose() unit: string;
}
@ApiSchema({ name: 'DevicesVirtualPluginDataNumericOperatorParameter' })
export class NumericOperatorParameterModel extends VirtualNumericRangeModel {
	@ApiProperty({ description: 'Whether the numeric parameter is required' }) @Expose() required: boolean;
}
@ApiSchema({ name: 'DevicesVirtualPluginDataNumericOperator' })
export class NumericOperatorModel {
	@ApiProperty({ description: 'Host package qualified identifier' }) @Expose() operatorId: string;
	@ApiProperty({ description: 'SDK contract version', enum: [1] }) @Expose() contractVersion: 1;
	@ApiProperty({ description: 'Bounded package local name' }) @Expose() name: string;
	@ApiProperty({ description: 'Immutable exact version', minimum: 1 }) @Expose() operatorVersion: number;
	@ApiProperty({ description: 'Input measurement', type: NumericMeasurementModel })
	@Expose()
	@Type(() => NumericMeasurementModel)
	input: NumericMeasurementModel;
	@ApiProperty({ description: 'Output measurement', type: NumericMeasurementModel })
	@Expose()
	@Type(() => NumericMeasurementModel)
	output: NumericMeasurementModel;
	@ApiProperty({ description: 'Supported finite input domain', type: VirtualNumericRangeModel })
	@Expose()
	@Type(() => VirtualNumericRangeModel)
	inputRange: VirtualNumericRangeModel;
	@ApiProperty({ description: 'Supported finite output domain', type: VirtualNumericRangeModel })
	@Expose()
	@Type(() => VirtualNumericRangeModel)
	outputRange: VirtualNumericRangeModel;
	@ApiProperty({
		description: 'Bounded finite numeric parameter schemas',
		type: 'object',
		additionalProperties: {
			type: 'object',
			required: ['minimum', 'maximum', 'required'],
			properties: { minimum: { type: 'number' }, maximum: { type: 'number' }, required: { type: 'boolean' } },
		},
	})
	@Expose()
	@Transform(({ obj }: { obj: NumericOperatorModel }) => obj.parameters)
	parameters: Record<string, NumericOperatorParameterModel>;
}
@ApiSchema({ name: 'DevicesVirtualPluginResNumericOperators' })
export class NumericOperatorsResponseModel extends BaseSuccessResponseModel<NumericOperatorModel[]> {
	@ApiProperty({ description: 'Currently available trusted numeric operators', type: [NumericOperatorModel] })
	@Expose()
	@Type(() => NumericOperatorModel)
	data: NumericOperatorModel[];
}
