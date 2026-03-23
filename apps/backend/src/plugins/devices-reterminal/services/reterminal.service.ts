import { Injectable, Logger } from '@nestjs/common';

import {
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import {
	DEFAULT_SENSOR_POLLING_INTERVAL_MS,
	DEVICES_RETERMINAL_PLUGIN_NAME,
	ReTerminalVariant,
} from '../devices-reterminal.constants';
import { ReTerminalDeviceEntity } from '../entities/devices-reterminal.entity';

import { ReTerminalDeviceMapperService } from './device-mapper.service';
import { ReTerminalButtonService } from './reterminal-button.service';
import { ReTerminalSysfsService } from './reterminal-sysfs.service';

@Injectable()
export class ReTerminalService implements IManagedPluginService {
	readonly pluginName = DEVICES_RETERMINAL_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private readonly logger = new Logger(ReTerminalService.name);
	private state: ServiceState = 'stopped';
	private device: ReTerminalDeviceEntity | null = null;
	private pollingInterval: ReturnType<typeof setInterval> | null = null;
	private detectedVariant: ReTerminalVariant | null = null;

	constructor(
		private readonly sysfsService: ReTerminalSysfsService,
		private readonly deviceMapper: ReTerminalDeviceMapperService,
		private readonly buttonService: ReTerminalButtonService,
	) {}

	getState(): ServiceState {
		return this.state;
	}

	async start(): Promise<void> {
		this.logger.log('Starting reTerminal plugin service...');
		this.state = 'starting';

		// Detect hardware variant
		this.detectedVariant = await this.sysfsService.detectVariant();

		if (!this.detectedVariant) {
			this.logger.warn('No reTerminal hardware detected - plugin will run in standby mode');
			this.state = 'started';

			return;
		}

		this.logger.log(`Detected reTerminal variant: ${this.detectedVariant}`);

		try {
			// Map device with all channels and properties
			this.device = await this.deviceMapper.mapDevice(this.detectedVariant);

			// Start button listener for reTerminal CM4 (has physical buttons)
			if (this.detectedVariant === ReTerminalVariant.RETERMINAL) {
				const inputDevice = await this.buttonService.findInputDevice();

				if (inputDevice) {
					this.buttonService.start(this.device.id, inputDevice);
				} else {
					this.logger.warn('Could not find button input device');
				}
			}

			// Start sensor polling
			this.startPolling();

			this.state = 'started';
			this.logger.log('reTerminal plugin service started successfully');
		} catch (error) {
			this.logger.error(`Failed to start reTerminal service: ${error}`);
			this.state = 'error';
		}
	}

	stop(): void {
		this.logger.log('Stopping reTerminal plugin service...');

		this.stopPolling();
		this.buttonService.stop();

		this.device = null;
		this.state = 'stopped';
	}

	private startPolling(): void {
		this.pollingInterval = setInterval(() => {
			if (!this.device) return;

			this.deviceMapper.updateSensorValues(this.device.id).catch((error) => {
				this.logger.debug(`Sensor polling error: ${error}`);
			});
		}, DEFAULT_SENSOR_POLLING_INTERVAL_MS);
	}

	private stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}
}
