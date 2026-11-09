import { Injectable } from '@nestjs/common';

import {
	IManagedExtensionService,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';

/**
 * Modbus runtime (managed connector service). Connection handling, polling and read-back are implemented later;
 * the device-level method signatures below are the stable contract.
 */
@Injectable()
export class ModbusRuntimeService implements IManagedExtensionService {
	readonly owner = { kind: 'plugin', type: DEVICES_MODBUS_PLUGIN_NAME } as const;
	readonly serviceId = 'connector';

	private state: ServiceState = 'stopped';

	start(): Promise<void> {
		this.state = 'started';

		return Promise.resolve();
	}

	stop(): Promise<void> {
		this.state = 'stopped';

		return Promise.resolve();
	}

	getState(): ServiceState {
		return this.state;
	}

	async loadDevice(_deviceId: string): Promise<void> {
		// Implemented with the connection pool
	}

	async unloadDevice(_deviceId: string): Promise<void> {
		// Implemented with the connection pool
	}

	async readBack(_deviceId: string, _propertyIds: string[]): Promise<void> {
		// Implemented with the polling engine
	}

	getConnection(_deviceId: string): null {
		return null;
	}
}
