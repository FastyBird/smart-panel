import type { NumericOperatorDefinition } from '@fastybird/smart-panel-extension-sdk';

/** Trusted fixture: a bounded temperature calibration, never a protective probe compiler. */
export const exampleNumericOperators: readonly NumericOperatorDefinition[] = [{
	contractVersion: 1,
	name: 'temperature_offset',
	operatorVersion: 1,
	input: { quantity: 'temperature', unit: '°C' },
	output: { quantity: 'temperature', unit: '°C' },
	inputRange: { minimum: -40, maximum: 100 },
	outputRange: { minimum: -50, maximum: 110 },
	parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
	evaluate: (input, parameters) => input + parameters.offset,
}];
