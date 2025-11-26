import { readFileSync } from 'fs';
import { join } from 'path';

import {
	BadRequestException,
	Controller,
	Get,
	InternalServerErrorException,
	Logger,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { Public } from '../../auth/guards/auth.guard';
import {
	PlatformException,
	PlatformNotSupportedException,
	PlatformValidationException,
} from '../../platform/platform.exceptions';
import { SystemHealthModel, SystemInfoModel, ThrottleStatusModel } from '../models/system.model';
import { SystemService } from '../services/system.service';
import { SYSTEM_MODULE_API_TAG_DESCRIPTION, SYSTEM_MODULE_API_TAG_NAME, SYSTEM_MODULE_NAME } from '../system.constants';

@ApiTag({
	tagName: SYSTEM_MODULE_NAME,
	displayName: SYSTEM_MODULE_API_TAG_NAME,
	description: SYSTEM_MODULE_API_TAG_DESCRIPTION,
})
@Controller('system')
export class SystemController {
	private readonly logger = new Logger(SystemController.name);

	constructor(private readonly systemService: SystemService) {}

	@Public()
	@Get('health')
	@ApiOperation({ summary: 'Get system health', description: 'Retrieve system health status and version' })
	@ApiSuccessResponse(SystemHealthModel, 'System health retrieved successfully')
	@ApiInternalServerErrorResponse()
	getSystemHealth(): SystemHealthModel {
		this.logger.debug('[LOOKUP] Health check');

		try {
			const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8')) as
				| { version: string }
				| undefined;

			return toInstance(SystemHealthModel, {
				status: 'ok',
				version: pkgJson.version ?? '0.0.0',
			});
		} catch (error) {
			this.handleError(error, 'Failed to create health response');
		}
	}

	@Get('info')
	@ApiOperation({ summary: 'Get system information', description: 'Retrieve detailed system information' })
	@ApiSuccessResponse(SystemInfoModel, 'System information retrieved successfully')
	@ApiBadRequestResponse('Platform not supported')
	@ApiInternalServerErrorResponse()
	async getSystemInfo(): Promise<SystemInfoModel> {
		this.logger.debug('[LOOKUP] Fetching system info');

		try {
			const systemInfo = await this.systemService.getSystemInfo();

			this.logger.debug('[LOOKUP] Successfully retrieved system info');

			return toInstance(SystemInfoModel, systemInfo);
		} catch (error) {
			this.handleError(error, 'Failed to retrieve system info');
		}
	}

	@Get('throttle')
	@ApiOperation({ summary: 'Get throttle status', description: 'Retrieve system throttling status' })
	@ApiSuccessResponse(ThrottleStatusModel, 'Throttle status retrieved successfully')
	@ApiBadRequestResponse('Platform not supported')
	@ApiInternalServerErrorResponse()
	async getThrottleStatus(): Promise<ThrottleStatusModel> {
		this.logger.debug('[LOOKUP] Fetching throttle status');

		try {
			const throttleStatus = await this.systemService.getThrottleStatus();

			this.logger.debug('[LOOKUP] Successfully retrieved throttle status');

			return toInstance(ThrottleStatusModel, throttleStatus);
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
