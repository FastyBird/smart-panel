/** Trusted synchronous Node code. This contract provides no CPU/memory sandbox or timeout. */
export type NumericMeasurement =
	| { readonly quantity: 'temperature'; readonly unit: '°C' }
	| { readonly quantity: 'humidity'; readonly unit: '%' }
	| { readonly quantity: 'concentration'; readonly unit: 'ppm' }
	| { readonly quantity: 'illuminance'; readonly unit: 'lx' }
	| { readonly quantity: 'voltage' | 'value'; readonly unit: 'V' };

export interface NumericOperatorRange {
	readonly minimum: number;
	readonly maximum: number;
}
export interface NumericOperatorParameter {
	readonly required: boolean;
	readonly minimum: number;
	readonly maximum: number;
}
export interface NumericOperatorDescriptor {
	readonly contractVersion: 1;
	readonly name: string;
	readonly operatorVersion: number;
	readonly input: NumericMeasurement;
	readonly output: NumericMeasurement;
	readonly inputRange: NumericOperatorRange;
	readonly outputRange: NumericOperatorRange;
	readonly parameters: Readonly<Record<string, NumericOperatorParameter>>;
}
export interface NumericOperatorDefinition extends NumericOperatorDescriptor {
	readonly evaluate: (input: number, parameters: Readonly<Record<string, number>>) => number;
}

const localName = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v);
const exactKeys = (v: object, keys: string[]) => Object.keys(v).every((key) => keys.includes(key));
export const isNumericOperatorRange = (v: NumericOperatorRange): boolean =>
	!!v &&
	exactKeys(v, ['minimum', 'maximum']) &&
	Number.isFinite(v.minimum) &&
	Number.isFinite(v.maximum) &&
	v.minimum <= v.maximum;
const measurement = (v: NumericMeasurement): boolean =>
	!!v &&
	exactKeys(v, ['quantity', 'unit']) &&
	['temperature:°C', 'humidity:%', 'concentration:ppm', 'illuminance:lx', 'voltage:V', 'value:V'].includes(
		`${v.quantity}:${v.unit}`,
	);

/** Validate and detach extension-owned descriptor objects before retaining them. */
export function snapshotNumericOperator(value: NumericOperatorDefinition): NumericOperatorDefinition {
	if (
		!value ||
		!exactKeys(value, [
			'contractVersion',
			'name',
			'operatorVersion',
			'input',
			'output',
			'inputRange',
			'outputRange',
			'parameters',
			'evaluate',
		]) ||
		value.contractVersion !== 1 ||
		!localName(value.name) ||
		!Number.isSafeInteger(value.operatorVersion) ||
		value.operatorVersion < 1 ||
		!measurement(value.input) ||
		!measurement(value.output) ||
		!isNumericOperatorRange(value.inputRange) ||
		!isNumericOperatorRange(value.outputRange) ||
		!value.parameters ||
		typeof value.parameters !== 'object' ||
		Array.isArray(value.parameters) ||
		Object.keys(value.parameters).length > 32 ||
		typeof value.evaluate !== 'function'
	)
		throw new Error('Invalid numeric operator definition');
	const parameters: Record<string, NumericOperatorParameter> = {};
	for (const [name, schema] of Object.entries(value.parameters)) {
		if (
			!localName(name) ||
			!schema ||
			!exactKeys(schema, ['required', 'minimum', 'maximum']) ||
			typeof schema.required !== 'boolean' ||
			!isNumericOperatorRange({ minimum: schema.minimum, maximum: schema.maximum })
		)
			throw new Error('Invalid numeric parameter schema');
		parameters[name] = Object.freeze({ ...schema });
	}
	return Object.freeze({
		...value,
		input: Object.freeze({ ...value.input }),
		output: Object.freeze({ ...value.output }),
		inputRange: Object.freeze({ ...value.inputRange }),
		outputRange: Object.freeze({ ...value.outputRange }),
		parameters: Object.freeze(parameters),
	});
}

export function validateNumericOperatorParameters(
	definition: NumericOperatorDescriptor,
	value: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
	if (
		!value ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call(definition.parameters, key))
	)
		throw new Error('Unknown numeric parameter');
	const result: Record<string, number> = {};
	for (const [name, schema] of Object.entries(definition.parameters)) {
		if (!Object.prototype.hasOwnProperty.call(value, name)) {
			if (schema.required) throw new Error('Missing numeric parameter');
			continue;
		}
		const n = value[name];
		if (typeof n !== 'number' || !Number.isFinite(n) || n < schema.minimum || n > schema.maximum)
			throw new Error('Invalid numeric parameter');
		result[name] = n;
	}
	return Object.freeze(result);
}
