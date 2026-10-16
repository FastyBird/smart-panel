import { Characteristic } from '@homebridge/hap-nodejs';

import { bindCharacteristicGet } from './characteristic-get';
import { HomeKitMapperContext } from './homekit-mapper.interface';
import { communicationFailure } from './property-read';
import { bindServiceFault, updateServiceFault } from './service-fault';

/** HAP-required fields without a source must fail even before the first GET. */
export function bindUnavailableCharacteristic(
	context: HomeKitMapperContext,
	characteristic: Characteristic,
	fault?: Characteristic,
): void {
	const read = () => {
		updateServiceFault(fault, characteristic, true);
		throw communicationFailure();
	};
	characteristic.updateValue(communicationFailure());
	updateServiceFault(fault, characteristic, true);
	bindCharacteristicGet(context, characteristic, read);
	if (fault) bindServiceFault(context, fault, characteristic, read);
}
