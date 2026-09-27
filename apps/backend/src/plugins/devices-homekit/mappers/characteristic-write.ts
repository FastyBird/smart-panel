import { Characteristic, CharacteristicValue, Perms } from '@homebridge/hap-nodejs';

/**
 * HAP otherwise caches and publishes the original SET value after awaiting the handler,
 * even when a newer command/report has already won. Return the current mapped value via
 * its supported write-response path and publish changes explicitly to other controllers.
 */
export function bindCharacteristicWrite(
	characteristic: Characteristic,
	write: (value: CharacteristicValue) => Promise<void>,
	currentValue: () => CharacteristicValue,
): void {
	if (!characteristic.props.perms.includes(Perms.WRITE_RESPONSE)) {
		characteristic.setProps({ perms: [...characteristic.props.perms, Perms.WRITE_RESPONSE] });
	}
	characteristic.onSet(async (value) => {
		await write(value);
		const current = currentValue();
		if (!Object.is(characteristic.value, current)) {
			characteristic.updateValue(current);
		}
		return current;
	});
}
