import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { ApiSuccessResponse } from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { RemoteAccessConfigModel } from '../models/config.model';
import { RemoteAccessProviderResponseModel, RemoteAccessProvidersResponseModel } from '../models/provider.model';
import { RemoteAccessStatusModel, RemoteAccessStatusResponseModel } from '../models/status.model';
import { RemoteAccessUrlsModel, RemoteAccessUrlsResponseModel } from '../models/urls.model';
import { REMOTE_ACCESS_MODULE_API_TAG_NAME, REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';
import { RemoteAccessPostureService } from '../services/remote-access-posture.service';
import { RemoteAccessStatusService } from '../services/remote-access-status.service';
import { RemoteAccessUrlService } from '../services/remote-access-url.service';

@ApiTags(REMOTE_ACCESS_MODULE_API_TAG_NAME)
@Controller()
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class RemoteAccessController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_MODULE_NAME, 'RemoteAccessController');

	constructor(
		private readonly configService: ConfigService,
		private readonly statusService: RemoteAccessStatusService,
		private readonly urlService: RemoteAccessUrlService,
		private readonly postureService: RemoteAccessPostureService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_MODULE_API_TAG_NAME],
		summary: 'Get remote access module status',
		description: 'Retrieve whether the module is enabled, every provider status, the URL registry and advisories',
		operationId: 'get-remote-access-module-status',
	})
	@ApiSuccessResponse(RemoteAccessStatusResponseModel, 'Remote access module status retrieved successfully')
	@Get('status')
	async getStatus(): Promise<RemoteAccessStatusResponseModel> {
		this.logger.debug('Fetching remote access module status');

		const config = this.configService.getModuleConfig<RemoteAccessConfigModel>(REMOTE_ACCESS_MODULE_NAME);
		const providers = await this.statusService.getAggregatedStatuses();
		const urls = await this.buildUrlsModel();
		const advisories = this.postureService.getAdvisories();

		const data = new RemoteAccessStatusModel();
		data.enabled = config.enabled;
		data.providers = providers;
		data.urls = urls;
		data.advisories = advisories;

		const response = new RemoteAccessStatusResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_MODULE_API_TAG_NAME],
		summary: 'Get remote access providers',
		description: 'Retrieve the live status of every registered remote access provider',
		operationId: 'get-remote-access-module-providers',
	})
	@ApiSuccessResponse(RemoteAccessProvidersResponseModel, 'Remote access providers retrieved successfully')
	@Get('providers')
	async getProviders(): Promise<RemoteAccessProvidersResponseModel> {
		this.logger.debug('Fetching remote access providers');

		const response = new RemoteAccessProvidersResponseModel();
		response.data = await this.statusService.getAggregatedStatuses();

		return response;
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_MODULE_API_TAG_NAME],
		summary: 'Get a remote access provider',
		description: 'Retrieve the live status of a single registered remote access provider',
		operationId: 'get-remote-access-module-provider',
	})
	@ApiParam({
		name: 'type',
		description: 'Provider plugin type',
		type: 'string',
		example: 'remote-access-tailscale-plugin',
	})
	@ApiSuccessResponse(RemoteAccessProviderResponseModel, 'Remote access provider retrieved successfully')
	@Get('providers/:type')
	async getProvider(@Param('type') type: string): Promise<RemoteAccessProviderResponseModel> {
		this.logger.debug(`Fetching remote access provider=${type}`);

		try {
			const response = new RemoteAccessProviderResponseModel();
			response.data = await this.statusService.getProviderStatus(type);

			return response;
		} catch (error) {
			if (error instanceof RemoteAccessProviderNotFoundException) {
				throw new NotFoundException(error.message);
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_MODULE_API_TAG_NAME],
		summary: 'Get remote access URLs',
		description: 'Retrieve the internal URL, display-only candidates, ranked external URLs and the primary URL',
		operationId: 'get-remote-access-module-urls',
	})
	@ApiSuccessResponse(RemoteAccessUrlsResponseModel, 'Remote access URLs retrieved successfully')
	@Get('urls')
	async getUrls(): Promise<RemoteAccessUrlsResponseModel> {
		this.logger.debug('Fetching remote access URLs');

		const response = new RemoteAccessUrlsResponseModel();
		response.data = await this.buildUrlsModel();

		return response;
	}

	private async buildUrlsModel(): Promise<RemoteAccessUrlsModel> {
		const snapshot = this.urlService.getUrls();
		const candidates = await this.urlService.getCandidates();

		const data = new RemoteAccessUrlsModel();
		data.internal = snapshot.internal;
		data.candidates = candidates;
		data.external = snapshot.external;
		data.primary = snapshot.primaryExternalUrl;

		return data;
	}
}
