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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../api/decorators/api-documentation.decorator';
import { Public } from '../../auth/guards/auth.guard';
import {
	PlatformException,
	PlatformNotSupportedException,
	PlatformValidationException,
} from '../../platform/platform.exceptions';
import {
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
} from '../models/system-response.model';
import { SystemHealthModel } from '../models/system.model';
import { SystemService } from '../services/system.service';
import { SYSTEM_MODULE_API_TAG_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('system')
export class SystemController {
	private readonly logger = new Logger(SystemController.name);

	constructor(private readonly systemService: SystemService) {}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get system health',
		description: 'Retrieve system health status and version',
		operationId: 'get-system-module-system-health',
	})
	@ApiSuccessResponse(SystemHealthResponseModel, 'System health retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Get('health')
	getSystemHealth(): SystemHealthResponseModel {
		this.logger.debug('[LOOKUP] Health check');

		try {
			const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8')) as
				| { version: string }
				| undefined;

			const data = toInstance(SystemHealthModel, {
				status: 'ok',
				version: pkgJson.version ?? '0.0.0',
			});

			const response = new SystemHealthResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			this.handleError(error, 'Failed to create health response');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get system information',
		description: 'Retrieve detailed system information',
		operationId: 'get-system-module-system-info',
	})
	@ApiSuccessResponse(SystemInfoResponseModel, 'System information retrieved successfully')
	@ApiBadRequestResponse('Platform not supported')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('info')
	async getSystemInfo(): Promise<SystemInfoResponseModel> {
		this.logger.debug('[LOOKUP] Fetching system info');

		try {
			const systemInfo = await this.systemService.getSystemInfo();

			this.logger.debug('[LOOKUP] Successfully retrieved system info');

			const response = new SystemInfoResponseModel();
			response.data = systemInfo;

			return response;
		} catch (error) {
			this.handleError(error, 'Failed to retrieve system info');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get throttle status',
		description: 'Retrieve system throttling status',
		operationId: 'get-system-module-system-throttle',
	})
	@ApiSuccessResponse(ThrottleStatusResponseModel, 'Throttle status retrieved successfully')
	@ApiBadRequestResponse('Platform not supported')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('throttle')
	async getThrottleStatus(): Promise<ThrottleStatusResponseModel> {
		this.logger.debug('[LOOKUP] Fetching throttle status');

		try {
			const throttleStatus = await this.systemService.getThrottleStatus();

			this.logger.debug('[LOOKUP] Successfully retrieved throttle status');

			const response = new ThrottleStatusResponseModel();
			response.data = throttleStatus;

			return response;
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
