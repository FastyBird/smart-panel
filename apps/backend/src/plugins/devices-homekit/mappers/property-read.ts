import { Characteristic, CharacteristicValue, HAPStatus, HapStatusError } from '@homebridge/hap-nodejs';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { HomeKitMapperContext } from './homekit-mapper.interface';

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
	map: (value: unknown) => CharacteristicValue,
	fault?: Characteristic,
): CharacteristicValue {
	const state = context.propertyState?.read(property);
	if (!state && property.requiresLiveValue) {
		fault?.updateValue(Characteristic.StatusFault.GENERAL_FAULT);
		throw communicationFailure();
	}
	const managed = state?.quality !== undefined && state.quality !== null;
	fault?.updateValue(
		context.availability?.isAvailable() === false || state?.unavailable || state?.quality === 'degraded'
			? Characteristic.StatusFault.GENERAL_FAULT
			: Characteristic.StatusFault.NO_FAULT,
	);
	try {
		if (!managed) return map(property.value?.value);
		if (state.unavailable || state.value === null) throw communicationFailure();
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
		const value = map(state.value);
		if (typeof value === 'number') validateHapNumber(characteristic, value);
		return value;
	} catch (error) {
		fault?.updateValue(Characteristic.StatusFault.GENERAL_FAULT);
		throw error;
	}
}
