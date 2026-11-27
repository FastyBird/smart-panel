import type { MeasurementAlias } from '../../devices-virtual/composables/use-virtual-device-extensions';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

/** The addon component and its identified probe can publish the same temperature. */
export const shellyMeasurementAlias: MeasurementAlias = (device, channel, property) => {
	if (
		device.type !== DEVICES_SHELLY_NG_TYPE ||
		channel.category !== 'temperature' ||
		property.category !== 'temperature' ||
		property.identifier !== 'tC' ||
		property.unit !== '°C'
	)
		return null;
	const identifier = channel.identifier ?? '';
	const canonical = /^probe-temperature:temperature:1\d\d:[a-f0-9]{64}$/.test(identifier);
	let component: string;
	if (canonical) {
		component = identifier.split(':').slice(1, 3).join(':');
	} else if (/^temperature:1\d\d$/.test(identifier)) {
		component = identifier;
	} else {
		return null;
	}
	return { key: JSON.stringify([device.id, component]), canonical };
};
