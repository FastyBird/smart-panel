import { Characteristic, CharacteristicGetHandler } from '@homebridge/hap-nodejs';

import { HomeKitMapperContext } from './homekit-mapper.interface';

export function bindCharacteristicGet(
	context: HomeKitMapperContext,
	characteristic: Characteristic,
	read: CharacteristicGetHandler,
): void {
	characteristic.onGet((...args) => {
		context.availability?.assertAvailable();
		return read(...args);
	});
}
