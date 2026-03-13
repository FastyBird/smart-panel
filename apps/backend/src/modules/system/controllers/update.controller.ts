import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqInstallUpdateDto } from '../dto/install-update.dto';
import { UpdateInfoResponseModel, UpdateStatusResponseModel } from '../models/update-response.model';
import { UpdateInfoModel, UpdateStatusModel } from '../models/update.model';
import { UpdateExecutorService } from '../services/update-executor.service';
import { UpdateService } from '../services/update.service';
import { SYSTEM_MODULE_API_TAG_NAME, SYSTEM_MODULE_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('system/update')
export class UpdateController {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateController');

	constructor(
		private readonly updateService: UpdateService,
		private readonly updateExecutor: UpdateExecutorService,
	) {}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Get update status',
		description: 'Returns current version, available updates, and update process status',
		operationId: 'get-system-module-update-status',
	})
	@ApiSuccessResponse(UpdateInfoResponseModel, 'Update status retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@Get('status')
	async getStatus(): Promise<UpdateInfoResponseModel> {
		this.logger.debug('Fetching update status');

		try {
			const info = await this.updateService.checkServerUpdate();

			const data = toInstance(UpdateInfoModel, {
				currentVersion: info.current,
				latestVersion: info.latest,
				updateAvailable: info.updateAvailable,
				updateType: info.updateType,
				lastChecked: new Date().toISOString(),
				changelogUrl: info.latest ? `https://github.com/FastyBird/smart-panel/releases/tag/v${info.latest}` : null,
			});

			const response = new UpdateInfoResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to get update status: ${err.message}`);

			throw new InternalServerErrorException('Failed to retrieve update status');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Check for updates',
		description: 'Force check for available updates by invalidating the cache',
		operationId: 'post-system-module-update-check',
	})
	@ApiSuccessResponse(UpdateInfoResponseModel, 'Update check completed')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Post('check')
	async checkForUpdates(): Promise<UpdateInfoResponseModel> {
		this.logger.debug('Force checking for updates');

		try {
			this.updateService.invalidateServerCache();

			const info = await this.updateService.checkServerUpdate();

			const data = toInstance(UpdateInfoModel, {
				currentVersion: info.current,
				latestVersion: info.latest,
				updateAvailable: info.updateAvailable,
				updateType: info.updateType,
				lastChecked: new Date().toISOString(),
				changelogUrl: info.latest ? `https://github.com/FastyBird/smart-panel/releases/tag/v${info.latest}` : null,
			});

			const response = new UpdateInfoResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to check for updates: ${err.message}`);

			throw new InternalServerErrorException('Failed to check for updates');
		}
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Install update',
		description: 'Start the update installation process. Requires admin role.',
		operationId: 'post-system-module-update-install',
	})
	@ApiBody({ type: ReqInstallUpdateDto })
	@ApiSuccessResponse(UpdateStatusResponseModel, 'Update process started')
	@ApiForbiddenResponse('Update not available or already in progress')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Post('install')
	async installUpdate(@Body() body: ReqInstallUpdateDto): Promise<UpdateStatusResponseModel> {
		this.logger.debug('Install update requested');

		if (this.updateService.isUpdateInProgress()) {
			throw new ForbiddenException('An update is already in progress');
		}

		const info = await this.updateService.checkServerUpdate();

		if (!info.updateAvailable && !body.version) {
			throw new ForbiddenException('No update available');
		}

		if (info.updateType === 'major' && !body.allowMajor) {
			throw new ForbiddenException(
				'Major version update requires explicit confirmation. Set allow_major to true to proceed.',
			);
		}

		const targetVersion = body.version ?? info.latest;

		if (!targetVersion) {
			throw new ForbiddenException('No target version available');
		}

		try {
			await this.updateExecutor.startUpdate(targetVersion);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to start update: ${err.message}`);

			throw new InternalServerErrorException('Failed to start update process');
		}

		const status = this.updateService.getStatus();

		const data = toInstance(UpdateStatusModel, {
			status: status.status,
			phase: status.phase,
			progressPercent: status.progressPercent,
			message: status.message,
			error: status.error,
		});

		const response = new UpdateStatusResponseModel();
		response.data = data;

		return response;
	}
}
