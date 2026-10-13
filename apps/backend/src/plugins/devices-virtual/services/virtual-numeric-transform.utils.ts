export enum VirtualNumericTransformOperator {
	AFFINE = 'affine',
	PIECEWISE_LINEAR = 'piecewise_linear',
	NTC_BETA = 'ntc_beta',
}

export interface VirtualNumericRange {
	minimum: number;
	maximum: number;
}

interface TransformDomain {
	inputRange: VirtualNumericRange;
	outputRange: VirtualNumericRange;
}

export type VirtualNumericTransformConfig = TransformDomain &
	(
		| { operator: VirtualNumericTransformOperator.AFFINE; scale: number; offset: number }
		| {
				operator: VirtualNumericTransformOperator.PIECEWISE_LINEAR;
				points: ReadonlyArray<{ x: number; y: number }>;
		  }
		| {
				operator: VirtualNumericTransformOperator.NTC_BETA;
				referenceVoltage: number;
				seriesResistance: number;
				nominalResistance: number;
				nominalTemperatureCelsius: number;
				beta: number;
				thermistorLeg: 'low' | 'high';
		  }
	);

export type VirtualNumericTransformFailure =
	| 'invalid_configuration'
	| 'invalid_input'
	| 'input_out_of_range'
	| 'invalid_domain'
	| 'nonfinite_output'
	| 'output_out_of_range';

export type VirtualNumericTransformResult =
	| { value: number; reason: null }
	| { value: null; reason: VirtualNumericTransformFailure };

const validRange = (range: VirtualNumericRange): boolean =>
	!!range && Number.isFinite(range.minimum) && Number.isFinite(range.maximum) && range.minimum <= range.maximum;

/** Shared by persistence, previews and runtime; bounded data only, never executable expressions. */
export function validateVirtualNumericTransform(config: VirtualNumericTransformConfig): string[] {
	if (!config) return ['missing_configuration'];
	const errors: string[] = [];
	const allowed = [
		'operator',
		'inputRange',
		'outputRange',
		...(config.operator === VirtualNumericTransformOperator.AFFINE
			? ['scale', 'offset']
			: config.operator === VirtualNumericTransformOperator.PIECEWISE_LINEAR
				? ['points']
				: [
						'referenceVoltage',
						'seriesResistance',
						'nominalResistance',
						'nominalTemperatureCelsius',
						'beta',
						'thermistorLeg',
					]),
	];
	if (Object.keys(config).some((key) => !allowed.includes(key) && config[key] !== undefined))
		errors.push('unsupported_parameters');
	for (const range of [config.inputRange, config.outputRange])
		if (range && Object.keys(range).some((key) => !['minimum', 'maximum'].includes(key)))
			errors.push('unsupported_range_parameters');

	if (!validRange(config.inputRange)) errors.push('invalid_input_range');
	if (!validRange(config.outputRange)) errors.push('invalid_output_range');
	switch (config.operator) {
		case VirtualNumericTransformOperator.AFFINE:
			if (!Number.isFinite(config.scale) || !Number.isFinite(config.offset)) errors.push('invalid_coefficients');
			break;
		case VirtualNumericTransformOperator.PIECEWISE_LINEAR: {
			if (!Array.isArray(config.points) || config.points.length < 2 || config.points.length > 256) {
				errors.push('invalid_calibration_count');
				break;
			}
			const points: ReadonlyArray<{ x: number; y: number }> = config.points;
			if (
				Array.from(points).some(
					(point, index) =>
						!point ||
						Object.keys(point).some((key) => !['x', 'y'].includes(key)) ||
						!Number.isFinite(point.x) ||
						!Number.isFinite(point.y) ||
						(index > 0 && point.x <= points[index - 1].x),
				)
			)
				errors.push('invalid_calibration_points');
			else if (
				validRange(config.inputRange) &&
				(config.inputRange.minimum < points[0].x || config.inputRange.maximum > points[points.length - 1].x)
			)
				errors.push('calibration_domain_exceeded');
			break;
		}
		case VirtualNumericTransformOperator.NTC_BETA:
			if (
				![config.referenceVoltage, config.seriesResistance, config.nominalResistance, config.beta].every(
					(value) => Number.isFinite(value) && value > 0,
				) ||
				!Number.isFinite(config.nominalTemperatureCelsius) ||
				config.nominalTemperatureCelsius <= -273.15 ||
				!['low', 'high'].includes(config.thermistorLeg)
			)
				errors.push('invalid_thermistor_parameters');
			break;
		default:
			errors.push('unsupported_operator');
	}
	return errors;
}

/** Conversion preserves no freshness itself: the caller must carry original qualified source evidence. */
export function evaluateVirtualNumericTransform(
	config: VirtualNumericTransformConfig,
	input: unknown,
): VirtualNumericTransformResult {
	const unavailable = (reason: VirtualNumericTransformFailure): VirtualNumericTransformResult => ({
		value: null,
		reason,
	});
	if (validateVirtualNumericTransform(config).length) return unavailable('invalid_configuration');
	if (typeof input !== 'number' || !Number.isFinite(input)) return unavailable('invalid_input');
	if (input < config.inputRange.minimum || input > config.inputRange.maximum) return unavailable('input_out_of_range');
	let output: number;
	switch (config.operator) {
		case VirtualNumericTransformOperator.AFFINE:
			output = config.scale * input + config.offset;
			break;
		case VirtualNumericTransformOperator.PIECEWISE_LINEAR: {
			const exact = config.points.find((point) => point.x === input);
			if (exact) {
				output = exact.y;
				break;
			}
			const index = config.points.findIndex((point) => point.x > input);
			if (index < 1) return unavailable('invalid_domain');
			const left = config.points[index - 1];
			const right = config.points[index];
			const span = right.x - left.x;
			const distance = input - left.x;
			if (!Number.isFinite(span) || !Number.isFinite(distance)) return unavailable('nonfinite_output');
			const fraction = distance / span;
			if (!Number.isFinite(fraction)) return unavailable('nonfinite_output');
			output = left.y + fraction * (right.y - left.y);
			break;
		}
		case VirtualNumericTransformOperator.NTC_BETA: {
			if (input <= 0 || input >= config.referenceVoltage) return unavailable('invalid_domain');
			const resistance =
				config.thermistorLeg === 'low'
					? (config.seriesResistance * input) / (config.referenceVoltage - input)
					: (config.seriesResistance * (config.referenceVoltage - input)) / input;
			if (!Number.isFinite(resistance) || resistance <= 0) return unavailable('invalid_domain');
			const denominator =
				1 / (config.nominalTemperatureCelsius + 273.15) +
				(Math.log(resistance) - Math.log(config.nominalResistance)) / config.beta;
			if (!Number.isFinite(denominator) || denominator <= 0) return unavailable('invalid_domain');
			output = 1 / denominator - 273.15;
			break;
		}
		default:
			return unavailable('invalid_configuration');
	}
	if (!Number.isFinite(output)) return unavailable('nonfinite_output');
	if (output < config.outputRange.minimum || output > config.outputRange.maximum)
		return unavailable('output_out_of_range');
	return { value: output, reason: null };
}
