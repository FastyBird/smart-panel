import { isNumericOperatorRange, validateNumericOperatorParameters } from '@fastybird/smart-panel-extension-sdk';
import { Injectable, Optional } from '@nestjs/common';

import { NumericOperatorScope, VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';
import {
	VirtualNumericTransformConfig,
	VirtualNumericTransformOperator,
	VirtualNumericTransformResult,
	evaluateVirtualNumericTransform,
	validateVirtualNumericTransform,
} from './virtual-numeric-transform.utils';

/** A single dispatch seam for preparation, both previews and live evaluation. */
@Injectable()
export class VirtualTransformResolver {
	constructor(@Optional() readonly registry?: VirtualNumericOperatorRegistry) {}
	capture(policy: VirtualNumericTransformConfig): NumericOperatorScope | null {
		return policy?.operator === VirtualNumericTransformOperator.EXTENSION
			? (this.registry?.capture(policy.operatorId, policy.operatorVersion) ?? null)
			: null;
	}
	validate(
		policy: VirtualNumericTransformConfig,
		input?: { quantity: string; unit: string },
		output?: { quantity: string; unit: string },
		scope = this.capture(policy),
	): string[] {
		if (policy?.operator !== VirtualNumericTransformOperator.EXTENSION) return validateVirtualNumericTransform(policy);
		const errors: string[] = [];
		if (
			Object.keys(policy).some(
				(key) =>
					![
						'operator',
						'contractVersion',
						'operatorId',
						'operatorVersion',
						'parameters',
						'inputRange',
						'outputRange',
					].includes(key),
			) ||
			policy.contractVersion !== 1 ||
			typeof policy.operatorId !== 'string' ||
			policy.operatorId.length > 280 ||
			!Number.isSafeInteger(policy.operatorVersion) ||
			policy.operatorVersion < 1 ||
			!isNumericOperatorRange(policy.inputRange) ||
			!isNumericOperatorRange(policy.outputRange)
		)
			return ['invalid_extension_policy'];
		if (!scope?.isCurrent()) return ['operator_unavailable'];
		const definition = scope.definition;
		for (const key of ['inputRange', 'outputRange'] as const)
			if (policy[key].minimum < definition[key].minimum || policy[key].maximum > definition[key].maximum)
				errors.push('operator_domain_mismatch');
		if (
			(input && (input.quantity !== definition.input.quantity || input.unit !== definition.input.unit)) ||
			(output && (output.quantity !== definition.output.quantity || output.unit !== definition.output.unit))
		)
			errors.push('operator_measurement_mismatch');
		try {
			validateNumericOperatorParameters(definition, policy.parameters);
		} catch {
			errors.push('invalid_operator_parameters');
		}
		return errors;
	}
	evaluate(
		policy: VirtualNumericTransformConfig,
		input: unknown,
		scope = this.capture(policy),
	): VirtualNumericTransformResult {
		if (policy?.operator !== VirtualNumericTransformOperator.EXTENSION)
			return evaluateVirtualNumericTransform(policy, input);
		if (this.validate(policy, undefined, undefined, scope).length || !scope?.isCurrent())
			return { value: null, reason: 'invalid_configuration' };
		if (typeof input !== 'number' || !Number.isFinite(input)) return { value: null, reason: 'invalid_input' };
		if (input < policy.inputRange.minimum || input > policy.inputRange.maximum)
			return { value: null, reason: 'input_out_of_range' };
		try {
			const result: unknown = scope.definition.evaluate(
				input,
				validateNumericOperatorParameters(scope.definition, policy.parameters),
			);
			if (typeof result !== 'number' || !Number.isFinite(result)) {
				// Never await extension work. Consume a rejected Promise/thenable to prevent process rejection leaks.
				if (
					result &&
					(typeof result === 'object' || typeof result === 'function') &&
					typeof (result as PromiseLike<unknown>).then === 'function'
				)
					void Promise.resolve(result).catch(() => undefined);
				return { value: null, reason: 'nonfinite_output' };
			}
			if (!scope.isCurrent()) return { value: null, reason: 'invalid_configuration' };
			if (result < policy.outputRange.minimum || result > policy.outputRange.maximum)
				return { value: null, reason: 'output_out_of_range' };
			return { value: result, reason: null };
		} catch {
			return { value: null, reason: 'invalid_domain' };
		}
	}
}
