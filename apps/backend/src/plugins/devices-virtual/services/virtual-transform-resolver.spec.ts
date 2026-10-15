import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { NumericOperatorDefinition } from '@fastybird/smart-panel-extension-sdk';

import { ConfigureVirtualTransformDto } from '../dto/transform-config.dto';
import { VirtualTransformConfigurationModel } from '../models/transform-response.model';

import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';
import { VirtualNumericTransformConfig, VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualTransformResolver } from './virtual-transform-resolver';

export const numericDefinition = (): NumericOperatorDefinition => ({
	contractVersion: 1,
	name: 'offset',
	operatorVersion: 1,
	input: { quantity: 'temperature', unit: '°C' },
	output: { quantity: 'temperature', unit: '°C' },
	inputRange: { minimum: -40, maximum: 100 },
	outputRange: { minimum: -50, maximum: 110 },
	parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
	evaluate: (n, p) => n + p.offset,
});
export const numericPolicy = (): VirtualNumericTransformConfig => ({
	operator: VirtualNumericTransformOperator.EXTENSION,
	contractVersion: 1,
	operatorId: '@fixture/operator:offset',
	operatorVersion: 1,
	parameters: { offset: 2 },
	inputRange: { minimum: -40, maximum: 100 },
	outputRange: { minimum: -50, maximum: 110 },
});

describe('trusted operator resolver', () => {
	let registry: VirtualNumericOperatorRegistry;
	let resolver: VirtualTransformResolver;
	beforeEach(() => {
		registry = new VirtualNumericOperatorRegistry();
		resolver = new VirtualTransformResolver(registry);
	});
	it('enforces host namespaces, duplicate owner/name/version rejection and exact immutable scopes', () => {
		const dispose = registry.activate('@fixture/operator', [numericDefinition()]);
		const old = resolver.capture(numericPolicy());
		expect(() => registry.activate('@fixture/operator', [numericDefinition()])).toThrow();
		expect(() =>
			registry.activate('other', [numericDefinition(), { ...numericDefinition(), operatorVersion: 2 }]),
		).toThrow();
		expect(resolver.evaluate(numericPolicy(), 20)).toEqual({ value: 22, reason: null });
		expect(resolver.validate({ ...numericPolicy(), operatorVersion: 2 } as VirtualNumericTransformConfig)).toContain(
			'operator_unavailable',
		);
		dispose();
		dispose();
		expect(old.isCurrent()).toBe(false);
		registry.activate('@fixture/operator', [numericDefinition()]);
		dispose();
		expect(resolver.capture(numericPolicy()).isCurrent()).toBe(true);
		expect(resolver.evaluate(numericPolicy(), 20, old).value).toBeNull();
	});
	it.each([
		() => {
			throw new Error('fixture');
		},
		() => NaN,
		() => Infinity,
		() => ({}),
		() => Promise.resolve(2),
		() => Promise.reject(new Error('contained')),
		() => ({ then: (_ok: unknown, fail: (error: Error) => void) => fail(new Error('contained thenable')) }),
	])('contains invalid synchronous results', async (evaluate) => {
		registry.activate('@fixture/operator', [{ ...numericDefinition(), evaluate: evaluate as never }]);
		expect(resolver.evaluate(numericPolicy(), 20).value).toBeNull();
		await new Promise(setImmediate);
	});
	it('validates parameter, exact quantity/unit and configured domain boundaries', () => {
		registry.activate('@fixture/operator', [numericDefinition()]);
		expect(resolver.validate(numericPolicy(), { quantity: 'temperature', unit: 'F' })).toContain(
			'operator_measurement_mismatch',
		);
		expect(resolver.validate({ ...numericPolicy(), inputRange: { minimum: -41, maximum: 100 } })).toContain(
			'operator_domain_mismatch',
		);
		expect(resolver.validate({ ...numericPolicy(), parameters: { offset: true } } as never)).toContain(
			'invalid_operator_parameters',
		);
	});

	it.each([
		{
			operator: 'affine',
			inputRange: { minimum: 0, maximum: 3 },
			outputRange: { minimum: 0, maximum: 10 },
			scale: 2,
			offset: 1,
		},
		{
			operator: 'piecewise_linear',
			inputRange: { minimum: 0, maximum: 3 },
			outputRange: { minimum: 0, maximum: 10 },
			points: [
				{ x: 0, y: 0 },
				{ x: 3, y: 6 },
			],
		},
		{
			operator: 'ntc_beta',
			inputRange: { minimum: 0.1, maximum: 3.2 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		},
		{
			operator: 'steinhart_hart',
			inputRange: { minimum: 0.1, maximum: 3.2 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			coefficientA: 0.001129148,
			coefficientB: 0.000234125,
			coefficientC: 8.76741e-8,
			thermistorLeg: 'low',
		},
	])('retains the exact legacy $operator JSON through request/response serialization', (policy) => {
		const dto = plainToInstance(ConfigureVirtualTransformDto, { policy });
		expect(instanceToPlain(dto).policy).toEqual(policy);
		const response = plainToInstance(VirtualTransformConfigurationModel, { policy }, { excludeExtraneousValues: true });
		expect(instanceToPlain(response).policy).toEqual(policy);
		expect(resolver.validate(policy as VirtualNumericTransformConfig)).toEqual([]);
	});
	it('preserves extension params and unknown stored versions through real class serialization', () => {
		const policy = { ...numericPolicy(), operatorVersion: 999, parameters: { future: 2 } };
		const model = plainToInstance(VirtualTransformConfigurationModel, { policy }, { excludeExtraneousValues: true });
		expect(instanceToPlain(model).policy).toEqual(policy);
		const dto = plainToInstance(ConfigureVirtualTransformDto, { policy: numericPolicy() });
		expect(dto.policy).toMatchObject(numericPolicy());
		expect(validateSync(dto).find((error) => error.property === 'policy')).toBeUndefined();
	});
});
