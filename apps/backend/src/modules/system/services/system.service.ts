import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../platform/services/platform.service';
import { NetworkStatsModel, SystemInfoModel, TemperatureInfoModel, ThrottleStatusModel } from '../models/system.model';
import { EventType } from '../system.constants';

@Injectable()
export class SystemService {
	private readonly logger = new Logger(SystemService.name);

	constructor(
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getSystemInfo(): Promise<SystemInfoModel> {
		const rawInfo = await this.platformService.getSystemInfo();

		return toInstance(SystemInfoModel, rawInfo);
	}

	async getThrottleStatus(): Promise<ThrottleStatusModel> {
		const rawStatus = await this.platformService.getThrottleStatus();

		return toInstance(ThrottleStatusModel, rawStatus);
	}

	async getTemperature(): Promise<TemperatureInfoModel> {
		const rawStatus = await this.platformService.getTemperature();

		return toInstance(TemperatureInfoModel, rawStatus);
	}

	async getNetworkStats(): Promise<NetworkStatsModel[]> {
		const rawStatus = await this.platformService.getNetworkStats();

		return rawStatus.map((item) => toInstance(NetworkStatsModel, item));
	}

	@Cron(CronExpression.EVERY_5_SECONDS)
	async broadcastSystemInfo() {
		try {
			const systemInfo = await this.getSystemInfo();

			this.eventEmitter.emit(EventType.SYSTEM_INFO, systemInfo);

			this.logger.debug('[EVENT] System info broadcasted successfully');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[EVENT] Failed to broadcast system info', { message: err.message, stack: err.stack });
		}
	}
}
