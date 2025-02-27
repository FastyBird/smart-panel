import { plainToInstance } from 'class-transformer';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PlatformService } from '../../platform/services/platform.service';
import {
	NetworkStatsEntity,
	SystemInfoEntity,
	TemperatureInfoEntity,
	ThrottleStatusEntity,
} from '../entities/system.entity';
import { EventType } from '../system.constants';

@Injectable()
export class SystemService {
	private readonly logger = new Logger(SystemService.name);

	constructor(
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getSystemInfo(): Promise<SystemInfoEntity> {
		const rawInfo = await this.platformService.getSystemInfo();

		return plainToInstance(SystemInfoEntity, rawInfo, { enableImplicitConversion: true, exposeUnsetFields: false });
	}

	async getThrottleStatus(): Promise<ThrottleStatusEntity> {
		const rawStatus = await this.platformService.getThrottleStatus();

		return plainToInstance(ThrottleStatusEntity, rawStatus, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});
	}

	async getTemperature(): Promise<TemperatureInfoEntity> {
		const rawStatus = await this.platformService.getTemperature();

		return plainToInstance(TemperatureInfoEntity, rawStatus, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});
	}

	async getNetworkStats(): Promise<NetworkStatsEntity[]> {
		const rawStatus = await this.platformService.getNetworkStats();

		return rawStatus.map((item) =>
			plainToInstance(NetworkStatsEntity, item, { enableImplicitConversion: true, exposeUnsetFields: false }),
		);
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
