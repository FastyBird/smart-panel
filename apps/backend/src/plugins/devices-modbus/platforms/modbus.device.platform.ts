import { Injectable } from '@nestjs/common';

import { IDevicePlatform } from '../../../modules/devices/platforms/device.platform';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

/**
 * Modbus device platform. Property writes are implemented together with the write path.
 */
@Injectable()
export class ModbusDevicePlatform implements IDevicePlatform {
	getType(): string {
		return DEVICES_MODBUS_TYPE;
	}

	process(): Promise<boolean> {
		return Promise.resolve(false);
	}

	processBatch(): Promise<boolean> {
		return Promise.resolve(false);
	}
}
