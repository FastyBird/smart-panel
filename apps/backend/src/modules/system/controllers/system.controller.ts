import { readFileSync } from 'fs';
import { join } from 'path';

import {
	BadRequestException,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { Public } from '../../auth/guards/auth.guard';
import {
	PlatformException,
	PlatformNotSupportedException,
	PlatformValidationException,
} from '../../platform/platform.exceptions';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	OnboardingStatusResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
} from '../models/system-response.model';
import { SystemHealthModel } from '../models/system.model';
import { OnboardingService } from '../services/onboarding.service';
import { SystemService } from '../services/system.service';
import { SYSTEM_MODULE_API_TAG_NAME, SYSTEM_MODULE_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('system')
export class SystemController {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'SystemController');

	constructor(
		private readonly systemService: SystemService,
		private readonly onboardingService: OnboardingService,
	) {}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get system health',
		description: 'Retrieve system health status and version',
		operationId: 'get-system-module-system-health',
	})
	@ApiSuccessResponse(SystemHealthResponseModel, 'System health retrieved successfully')
	@ApiServiceUnavailableResponse('Service is temporarily unavailable')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Get('health')
	getSystemHealth(): SystemHealthResponseModel {
		this.logger.debug('Health check');

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
		this.logger.debug('Fetching system info');

		try {
			const systemInfo = await this.systemService.getSystemInfo();

			this.logger.debug('Successfully retrieved system info');

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
		this.logger.debug('Fetching throttle status');

		try {
			const throttleStatus = await this.systemService.getThrottleStatus();

			this.logger.debug('Successfully retrieved throttle status');

			const response = new ThrottleStatusResponseModel();
			response.data = throttleStatus;

			return response;
		} catch (error) {
			this.handleError(error, 'Failed to retrieve throttle status');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get onboarding status',
		description: 'Retrieve the current onboarding status including whether an owner exists and setup statistics',
		operationId: 'get-system-module-onboarding-status',
	})
	@ApiSuccessResponse(OnboardingStatusResponseModel, 'Onboarding status retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Public()
	@Get('onboarding')
	async getOnboardingStatus(): Promise<OnboardingStatusResponseModel> {
		this.logger.debug('Fetching onboarding status');

		try {
			const status = await this.onboardingService.getStatus();

			const response = new OnboardingStatusResponseModel();
			response.data = status;

			return response;
		} catch (error) {
			this.handleError(error, 'Failed to retrieve onboarding status');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Mark onboarding as complete',
		description: 'Mark the initial onboarding wizard as completed',
		operationId: 'post-system-module-onboarding-complete',
	})
	@ApiSuccessResponse(OnboardingStatusResponseModel, 'Onboarding marked as complete')
	@ApiInternalServerErrorResponse('Internal server error')
	@HttpCode(HttpStatus.OK)
	@Post('onboarding/complete')
	async completeOnboarding(): Promise<OnboardingStatusResponseModel> {
		this.logger.debug('Marking onboarding as complete');

		try {
			this.onboardingService.markComplete();
			const status = await this.onboardingService.getStatus();

			const response = new OnboardingStatusResponseModel();
			response.data = status;

			return response;
		} catch (error) {
			this.handleError(error, 'Failed to mark onboarding as complete');
		}
	}

	private handleError(error: unknown, contextMessage: string): never {
		if (error instanceof PlatformNotSupportedException) {
			this.logger.warn(`${contextMessage}: Platform not supported`, { error });
			throw new BadRequestException(error.message);
		}

		if (error instanceof PlatformValidationException) {
			this.logger.warn(`${contextMessage}: Validation error`, { error });
			throw new UnprocessableEntityException(error.message);
		}

		if (error instanceof PlatformException) {
			this.logger.error(`${contextMessage}: Platform-related error occurred`, { error });
			throw new InternalServerErrorException(error.message);
		}

		this.logger.error(`${contextMessage}: Unexpected error occurred`, { error });
		throw new InternalServerErrorException('An unexpected error occurred');
	}
}
