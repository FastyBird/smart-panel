import { Characteristic, CharacteristicValue, HAPStatus, HapStatusError } from '@homebridge/hap-nodejs';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext } from './homekit-mapper.interface';
import { updateServiceFault } from './service-fault';

/** Explicit mapper-owned semantic conversion; raw numeric measurements never opt in. */
export type ManagedSemanticConversion = (value: unknown, property: ChannelPropertyEntity) => CharacteristicValue;

export function communicationFailure(): HapStatusError {
	return new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
}

/** HAP silently clamps numeric values; managed measurements must fail instead of fabricating evidence. */
export function validateHapNumber(characteristic: Characteristic, value: unknown): number {
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		(characteristic.props.minValue !== undefined && value < characteristic.props.minValue) ||
		(characteristic.props.maxValue !== undefined && value > characteristic.props.maxValue)
	)
		throw communicationFailure();
	return value;
}

export function readMappedProperty(
	context: HomeKitMapperContext,
	property: ChannelPropertyEntity,
	characteristic: Characteristic,
	map: (value: unknown, property?: ChannelPropertyEntity) => CharacteristicValue,
	fault?: Characteristic,
	semanticConversion?: ManagedSemanticConversion,
	validateProperty?: (property: ChannelPropertyEntity) => void,
): CharacteristicValue {
	const state = context.propertyState?.read(property);
	if (!state && property.requiresLiveValue) {
		updateServiceFault(fault, characteristic, true);
		throw communicationFailure();
	}
	const managed = state?.quality !== undefined && state.quality !== null;

	try {
		validateProperty?.(property);
		const value = read();
		updateServiceFault(
			fault,
			characteristic,
			context.availability?.isAvailable() === false || state?.quality === 'degraded',
		);
		return value;
	} catch (error) {
		updateServiceFault(fault, characteristic, true);
		throw error;
	}

	function read(): CharacteristicValue {
		if (!managed) return map(property.value?.value, property);
		if (state.unavailable || state.value === null) throw communicationFailure();
		if (semanticConversion) {
			const converted = semanticConversion(state.value, property);
			if (typeof converted !== 'number') throw communicationFailure();
			return validateHapNumber(characteristic, converted);
		}
		if (
			typeof state.value !== 'boolean' &&
			(characteristic.props.format === 'float' ||
				characteristic.props.format.startsWith('uint') ||
				characteristic.props.format === 'int')
		) {
			let numeric = state.value;
			// ColorTemperature is the sole supported reciprocal unit conversion (Kelvin -> mired).
			if (
				characteristic.UUID === Characteristic.ColorTemperature.UUID &&
				property.unit === 'K' &&
				typeof numeric === 'number'
			)
				numeric = 1_000_000 / numeric;
			validateHapNumber(characteristic, numeric);
		}
		const value = map(state.value, property);
		if (typeof value === 'number') validateHapNumber(characteristic, value);
		return value;
	}
}
