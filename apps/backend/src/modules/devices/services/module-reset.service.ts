import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { DEVICES_MODULE_NAME, EventType } from '../devices.constants';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';

@Injectable()
export class ModuleResetService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ModuleResetService');

	constructor(
		@InjectRepository(DeviceEntity)
		private readonly devicesRepository: Repository<DeviceEntity>,
		@InjectRepository(DeviceControlEntity)
		private readonly devicesControlsRepository: Repository<DeviceControlEntity>,
		@InjectRepository(ChannelEntity)
		private readonly channelsRepository: Repository<ChannelEntity>,
		@InjectRepository(ChannelPropertyEntity)
		private readonly channelsPropertiesRepository: Repository<ChannelPropertyEntity>,
		@InjectRepository(ChannelControlEntity)
		private readonly channelsControlsRepository: Repository<ChannelControlEntity>,
		private readonly influxDbService: InfluxDbService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.channelsPropertiesRepository.deleteAll();

			this.eventEmitter.emit(EventType.DEVICE_RESET, null);

			await this.channelsControlsRepository.deleteAll();

			this.eventEmitter.emit(EventType.DEVICE_CONTROL_RESET, null);

			await this.channelsRepository.deleteAll();

			this.eventEmitter.emit(EventType.CHANNEL_RESET, null);

			await this.devicesControlsRepository.deleteAll();

			this.eventEmitter.emit(EventType.CHANNEL_CONTROL_RESET, null);

			await this.devicesRepository.deleteAll();

			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_RESET, null);

			await this.influxDbService.dropMeasurement('property_value');
			await this.influxDbService.dropMeasurement('device_state');

			this.logger.log('Module data were successfully reset');

			this.eventEmitter.emit(EventType.MODULE_RESET, null);

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to reset module data', { message: err.message, stack: err.stack });

			return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
		}
	}
}
