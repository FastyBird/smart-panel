import { plainToInstance } from 'class-transformer';

import {
	BadRequestException,
	Controller,
	Get,
	InternalServerErrorException,
	Logger,
	UnprocessableEntityException,
} from '@nestjs/common';

import {
	PlatformException,
	PlatformNotSupportedException,
	PlatformValidationException,
} from '../../platform/platform.exceptions';
import { SystemInfoEntity, ThrottleStatusEntity } from '../entities/system.entity';
import { SystemService } from '../services/system.service';

@Controller('system')
export class SystemController {
	private readonly logger = new Logger(SystemController.name);

	constructor(private readonly systemService: SystemService) {}

	@Get('info')
	async getSystemInfo(): Promise<SystemInfoEntity> {
		this.logger.debug('[LOOKUP] Fetching system info');

		try {
			const systemInfo = await this.systemService.getSystemInfo();

			this.logger.debug('[LOOKUP] Successfully retrieved system info');

			return plainToInstance(SystemInfoEntity, systemInfo, {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});
		} catch (error) {
			this.handleError(error, 'Failed to retrieve system info');
		}
	}

	@Get('throttle')
	async getThrottleStatus(): Promise<ThrottleStatusEntity> {
		this.logger.debug('[LOOKUP] Fetching throttle status');

		try {
			const throttleStatus = await this.systemService.getThrottleStatus();

			this.logger.debug('[LOOKUP] Successfully retrieved throttle status');

			return plainToInstance(ThrottleStatusEntity, throttleStatus, {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});
		} catch (error) {
			this.handleError(error, 'Failed to retrieve throttle status');
		}
	}

	private handleError(error: unknown, contextMessage: string): never {
		if (error instanceof PlatformNotSupportedException) {
			this.logger.warn(`[ERROR] ${contextMessage}: Platform not supported`, error);
			throw new BadRequestException(error.message);
		}

		if (error instanceof PlatformValidationException) {
			this.logger.warn(`[ERROR] ${contextMessage}: Validation error`, error);
			throw new UnprocessableEntityException(error.message);
		}

		if (error instanceof PlatformException) {
			this.logger.error(`[ERROR] ${contextMessage}: Platform-related error occurred`, error);
			throw new InternalServerErrorException(error.message);
		}

		this.logger.error(`[ERROR] ${contextMessage}: Unexpected error occurred`, error);
		throw new InternalServerErrorException('An unexpected error occurred');
	}
}
