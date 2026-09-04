import { HAPStatus, HapStatusError } from '@homebridge/hap-nodejs';
import { Injectable, Logger } from '@nestjs/common';

import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';

@Injectable()
export class HomeKitCommandDispatcher {
	private readonly logger = new Logger(HomeKitCommandDispatcher.name);

	constructor(private readonly propertyCommandService: PropertyCommandService) {}

	async dispatch(propertyId: string, value: unknown): Promise<void> {
		try {
			this.logger.debug(`Dispatching HomeKit command for property=${propertyId} value=${JSON.stringify(value)}`);

			const result = await this.propertyCommandService.executePropertyCommandById(propertyId, value);

			if (!result.success) {
				this.logger.warn(`Property command failed: ${result.reason ?? 'Unknown reason'}`);
				throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		} catch (error) {
			if (error instanceof HapStatusError) {
				throw error;
			}
			const err = error as Error;
			this.logger.error(`Error executing HomeKit property command: ${err.message}`, err.stack);
			throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}
}
