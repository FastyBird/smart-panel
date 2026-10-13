import {
	VirtualNumericTransformOperator as Operator,
	VirtualNumericTransformConfig,
	evaluateVirtualNumericTransform as evaluate,
	validateVirtualNumericTransform as validate,
} from './virtual-numeric-transform.utils';

const affine: VirtualNumericTransformConfig = {
	operator: Operator.AFFINE,
	inputRange: { minimum: -100, maximum: 100 },
	outputRange: { minimum: -500, maximum: 500 },
	scale: 2,
	offset: 5,
};
const piecewise: VirtualNumericTransformConfig = {
	operator: Operator.PIECEWISE_LINEAR,
	inputRange: { minimum: 0, maximum: 10 },
	outputRange: { minimum: -20, maximum: 40 },
	points: [
		{ x: 0, y: -20 },
		{ x: 4, y: 0 },
		{ x: 10, y: 40 },
	],
};
const ntc: VirtualNumericTransformConfig = {
	operator: Operator.NTC_BETA,
	inputRange: { minimum: 0, maximum: 3.3 },
	outputRange: { minimum: -100, maximum: 150 },
	referenceVoltage: 3.3,
	seriesResistance: 10_000,
	nominalResistance: 10_000,
	nominalTemperatureCelsius: 25,
	beta: 3950,
	thermistorLeg: 'low',
};
const steinhartHart: VirtualNumericTransformConfig = {
	operator: Operator.STEINHART_HART,
	inputRange: { minimum: 0, maximum: 10 },
	outputRange: { minimum: -100, maximum: 150 },
	referenceVoltage: 10,
	seriesResistance: 10_000,
	coefficientA: 0.0010351024725298568,
	coefficientB: 0.0002338353574079741,
	coefficientC: 7.917851073336009e-8,
	thermistorLeg: 'low',
};

describe('virtual numeric transform operators', () => {
	it.each([
		[-100, -195],
		[0, 5],
		[100, 205],
	])('converts affine %s with explicit coefficients', (input, output) => {
		expect(evaluate(affine, input)).toEqual({ value: output, reason: null });
	});
	it.each([null, undefined, '2', true, NaN, Infinity, -Infinity])('refuses nonnumeric/nonfinite input %s', (input) => {
		expect(evaluate(affine, input)).toEqual({ value: null, reason: 'invalid_input' });
	});
	it('never clamps input or output to declared ranges', () => {
		expect(evaluate(affine, 101)).toEqual({ value: null, reason: 'input_out_of_range' });
		expect(evaluate({ ...affine, outputRange: { minimum: 0, maximum: 10 } }, 4)).toEqual({
			value: null,
			reason: 'output_out_of_range',
		});
	});
	it('rejects affine overflow even though every input and coefficient is finite', () => {
		expect(evaluate({ ...affine, scale: Number.MAX_VALUE }, 2)).toEqual({ value: null, reason: 'nonfinite_output' });
	});
	it.each([
		[0, -20],
		[2, -10],
		[4, 0],
		[7, 20],
		[10, 40],
	])('interpolates calibration %s including exact knots', (input, output) => {
		expect(evaluate(piecewise, input)).toEqual({ value: output, reason: null });
	});
	it('does not extrapolate beyond calibration even if a wider range was supplied', () => {
		expect(validate({ ...piecewise, inputRange: { minimum: -1, maximum: 10 } })).toContain(
			'calibration_domain_exceeded',
		);
		expect(evaluate(piecewise, 11)).toEqual({ value: null, reason: 'input_out_of_range' });
	});
	it.each(
		[
			[{ x: 0, y: 1 }],
			[
				{ x: 0, y: 1 },
				{ x: 0, y: 2 },
			],
			[
				{ x: 4, y: 1 },
				{ x: 0, y: 2 },
			],
			[
				{ x: 0, y: NaN },
				{ x: 10, y: 2 },
			],
			[
				{ x: 0, y: 1 },
				{ x: Infinity, y: 2 },
			],
		].map((points) => ({ points })),
	)('refuses malformed calibration %j', ({ points }) => {
		expect(evaluate({ ...piecewise, points }, 2)).toEqual({ value: null, reason: 'invalid_configuration' });
	});
	it('bounds calibration size and rejects intermediate interpolation overflow', () => {
		expect(validate({ ...piecewise, points: Array.from({ length: 257 }, (_, x) => ({ x, y: x })) })).toContain(
			'invalid_calibration_count',
		);
		const config = {
			...piecewise,
			points: [
				{ x: 0, y: -Number.MAX_VALUE },
				{ x: 10, y: Number.MAX_VALUE },
			],
		};
		expect(evaluate(config, 5)).toEqual({ value: null, reason: 'nonfinite_output' });
	});
	it.each([0, 1])(
		'rejects an infinite calibration span instead of publishing a false finite fraction at %s',
		(input) => {
			expect(
				evaluate(
					{
						...piecewise,
						inputRange: { minimum: -Number.MAX_VALUE, maximum: Number.MAX_VALUE },
						outputRange: { minimum: 0, maximum: 100 },
						points: [
							{ x: -Number.MAX_VALUE, y: 0 },
							{ x: Number.MAX_VALUE, y: 100 },
						],
					},
					input,
				),
			).toEqual({ value: null, reason: 'nonfinite_output' });
		},
	);

	it.each(['low', 'high'] as const)('uses explicit %s divider orientation at nominal temperature', (thermistorLeg) => {
		expect(evaluate({ ...ntc, thermistorLeg }, 1.65).value).toBeCloseTo(25, 8);
	});
	it('matches independent 50°C divider fixtures for both orientations', () => {
		expect(evaluate(ntc, 0.8714191503515206).value).toBeCloseTo(50, 3);
		expect(evaluate({ ...ntc, thermistorLeg: 'high' }, 2.4285808496484793).value).toBeCloseTo(50, 3);
	});
	it.each([0, 3.3])('rejects rail voltage %s rather than fabricating temperature', (input) => {
		expect(evaluate(ntc, input)).toEqual({ value: null, reason: 'invalid_domain' });
	});
	it.each([
		{ beta: 0 },
		{ seriesResistance: -1 },
		{ nominalResistance: Infinity },
		{ referenceVoltage: NaN },
		{ nominalTemperatureCelsius: -273.15 },
		{ thermistorLeg: 'unknown' },
	])('requires explicit valid thermistor parameters %j', (parameters) => {
		expect(evaluate({ ...ntc, ...parameters } as VirtualNumericTransformConfig, 1)).toEqual({
			value: null,
			reason: 'invalid_configuration',
		});
	});
	it('rejects nonpositive Kelvin denominator and resistance overflow', () => {
		expect(evaluate({ ...ntc, beta: 1 }, 0.1)).toEqual({ value: null, reason: 'invalid_domain' });
		expect(evaluate({ ...ntc, seriesResistance: Number.MAX_VALUE }, 3)).toEqual({
			value: null,
			reason: 'invalid_domain',
		});
	});
	it.each([
		[2.5, 63.08],
		[5, 34.48],
		[6.68, 18.45],
		[8, 4.07],
	])('matches independent script Steinhart-Hart calibration at %s V', (voltage, expectedCelsius) => {
		const result = evaluate(steinhartHart, voltage);
		expect(result.reason).toBeNull();
		expect(result.value).toBeCloseTo(expectedCelsius, 2);
	});
	it('uses the selected divider leg and refuses rails, invalid coefficients and denominator', () => {
		expect(evaluate({ ...steinhartHart, thermistorLeg: 'high' }, 3.32).value).toBeCloseTo(18.45, 2);
		for (const voltage of [0, 10, 11])
			expect(evaluate({ ...steinhartHart, inputRange: { minimum: 0, maximum: 12 } }, voltage)).toEqual({
				value: null,
				reason: 'invalid_domain',
			});
		for (const override of [
			{ coefficientA: NaN },
			{ coefficientB: Infinity },
			{ coefficientC: undefined },
			{ referenceVoltage: 0 },
			{ seriesResistance: -1 },
			{ coefficientA: 0, coefficientB: 0, coefficientC: 0 },
		])
			expect(evaluate({ ...steinhartHart, ...override } as VirtualNumericTransformConfig, 6.68)).toEqual({
				value: null,
				reason: 'invalid_configuration',
			});
		expect(evaluate({ ...steinhartHart, coefficientA: -1 }, 6.68)).toEqual({ value: null, reason: 'invalid_domain' });
		expect(evaluate({ ...steinhartHart, seriesResistance: Number.MAX_VALUE }, 9)).toEqual({
			value: null,
			reason: 'invalid_domain',
		});
	});
	it.each([
		{ minimum: NaN, maximum: 10 },
		{ minimum: 1, maximum: 0 },
		{ minimum: 0, maximum: Infinity },
	])('rejects invalid declared range %j consistently for preview and evaluation', (inputRange) => {
		expect(validate({ ...affine, inputRange })).toContain('invalid_input_range');
		expect(evaluate({ ...affine, inputRange }, 2)).toEqual({ value: null, reason: 'invalid_configuration' });
	});
	it('does not infer parameters or execute an unknown operator', () => {
		expect(evaluate({ ...affine, operator: 'expression' } as unknown as VirtualNumericTransformConfig, 1)).toEqual({
			value: null,
			reason: 'invalid_configuration',
		});
	});
});
