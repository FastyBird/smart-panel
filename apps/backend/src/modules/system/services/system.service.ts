import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { SystemInfoDto } from '../../platform/dto/system-info.dto';
import { PlatformService } from '../../platform/services/platform.service';
import { NetworkStatsModel, SystemInfoModel, TemperatureInfoModel, ThrottleStatusModel } from '../models/system.model';
import { EventType, SYSTEM_MODULE_NAME } from '../system.constants';

const SYSTEM_INFO_TIMEOUT_MS = 10_000;

@Injectable()
export class SystemService {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'SystemService');
	private systemInfoRequest: Promise<SystemInfoDto> | null = null;

	constructor(
		private readonly platformService: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getSystemInfo(): Promise<SystemInfoModel> {
		// The system and stats broadcasts run on the same five-second schedule. Share their
		// expensive platform sample, including concurrent HTTP callers, only while it is pending.
		const request = this.systemInfoRequest ?? this.startSystemInfoRequest();
		const rawInfo = await request;

		// Each consumer owns its model; sharing the sample must not share mutable responses.
		return toInstance(SystemInfoModel, {
			...rawInfo,
			platform: this.platformService.getPlatformType(),
		});
	}

	private startSystemInfoRequest(): Promise<SystemInfoDto> {
		const sample = this.platformService.getSystemInfo();
		let timeout: ReturnType<typeof setTimeout>;
		const request = new Promise<SystemInfoDto>((resolve, reject) => {
			timeout = setTimeout(() => {
				reject(new Error(`System information probe timed out after ${SYSTEM_INFO_TIMEOUT_MS} ms`));
			}, SYSTEM_INFO_TIMEOUT_MS);
			void sample.then(resolve, reject);
		});

		// The platform API cannot cancel its probes. Keep the rejected request while the actual
		// sample still runs: later callers fail promptly instead of accumulating waiters or probes.
		// Only real settlement permits a fresh sample; a late result never becomes a fresh response.
		const release = (): void => {
			clearTimeout(timeout);
			if (this.systemInfoRequest === request) this.systemInfoRequest = null;
		};
		void sample.then(release, release);
		this.systemInfoRequest = request;

		return request;
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

			this.logger.debug('System info broadcasted successfully');
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to broadcast system info', { message: err.message, stack: err.stack });
		}
	}
}
