import { matchesStep } from '../../../modules/devices/utils/property-command-value.utils';
import { HomeyCapability, HomeyCapabilityType, HomeyCapabilityValue } from '../models/homey-capability.model';

export interface HomeyCapabilityCommandValidation {
	readonly valid: boolean;
	readonly reason?: string;
}

export function validateHomeyCapabilityCommandValue(
	capability: HomeyCapability,
	value: HomeyCapabilityValue,
): HomeyCapabilityCommandValidation {
	if (!capability.writable) {
		return { valid: false, reason: 'Homey capability is not writable' };
	}

	if (capability.available === false) {
		return { valid: false, reason: 'Homey capability is unavailable' };
	}

	if (value === null) {
		return { valid: false, reason: 'Homey command value must not be null' };
	}

	switch (capability.type) {
		case HomeyCapabilityType.BOOLEAN:
			if (typeof value !== 'boolean') {
				return { valid: false, reason: 'Homey command value must be a boolean' };
			}
			break;
		case HomeyCapabilityType.NUMBER:
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				return { valid: false, reason: 'Homey command value must be a finite number' };
			}
			if (capability.minimum !== null && value < capability.minimum) {
				return { valid: false, reason: 'Homey command value is below the capability minimum' };
			}
			if (capability.maximum !== null && value > capability.maximum) {
				return { valid: false, reason: 'Homey command value is above the capability maximum' };
			}
			if (capability.step !== null) {
				if (!Number.isFinite(capability.step) || capability.step <= 0) {
					return { valid: false, reason: 'Homey capability has an invalid step constraint' };
				}

				const base = capability.minimum ?? 0;

				if (!matchesStep(value, capability.step, base)) {
					return { valid: false, reason: 'Homey command value does not align to the capability step' };
				}
			}
			break;
		case HomeyCapabilityType.STRING:
			if (typeof value !== 'string' || value.length === 0) {
				return { valid: false, reason: 'Homey command value must be a non-empty string' };
			}
			break;
		case HomeyCapabilityType.ENUM:
			if (typeof value !== 'string' || !capability.enumValues.some((candidate) => candidate.id === value)) {
				return { valid: false, reason: 'Homey command value is not in the capability enum' };
			}
			break;
		case HomeyCapabilityType.UNKNOWN:
			return { valid: false, reason: 'Homey capability type is unsupported for commands' };
	}

	return { valid: true };
}

export function homeyCapabilityValuesEqual(left: HomeyCapabilityValue, right: HomeyCapabilityValue): boolean {
	if (typeof left !== 'number' || typeof right !== 'number') {
		return left === right;
	}

	const tolerance = Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 16;

	return Math.abs(left - right) <= tolerance;
}
