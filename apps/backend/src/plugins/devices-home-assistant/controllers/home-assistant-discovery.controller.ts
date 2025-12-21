import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
} from '../devices-home-assistant.constants';
import { DiscoveredInstanceModel, DiscoveredInstancesResponseModel } from '../models/discovered-instance.model';
import { HaMdnsDiscovererService } from '../services/ha-mdns-discoverer.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME)
@Controller('discovery')
export class HomeAssistantDiscoveryController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantDiscoveryController',
	);

	constructor(private readonly discovererService: HaMdnsDiscovererService) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Get discovered Home Assistant instances',
		description:
			'Returns a list of Home Assistant instances discovered via mDNS on the local network. ' +
			'These instances can be configured in the plugin settings.',
		operationId: 'get-devices-home-assistant-plugin-discovery',
	})
	@ApiSuccessResponse(DiscoveredInstancesResponseModel, 'List of discovered Home Assistant instances.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getDiscoveredInstances(): Promise<DiscoveredInstancesResponseModel> {
		this.logger.debug('Incoming request to get discovered Home Assistant instances');

		const discoveredInstances = this.discovererService.getDiscoveredInstances();

		const instances: DiscoveredInstanceModel[] = discoveredInstances.map((instance) =>
			toInstance(DiscoveredInstanceModel, {
				hostname: instance.hostname,
				port: instance.port,
				name: instance.name,
				version: instance.version ?? null,
				uuid: instance.uuid ?? null,
			}),
		);

		const response = new DiscoveredInstancesResponseModel();
		response.data = instances;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Refresh Home Assistant instance discovery',
		description: 'Restarts the mDNS discovery process to find new Home Assistant instances.',
		operationId: 'post-devices-home-assistant-plugin-discovery-refresh',
	})
	@ApiSuccessResponse(DiscoveredInstancesResponseModel, 'Discovery refreshed and current list returned.')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('refresh')
	async refreshDiscovery(): Promise<DiscoveredInstancesResponseModel> {
		this.logger.debug('Incoming request to refresh Home Assistant discovery');

		this.discovererService.refresh();

		// Return current list (may be empty right after refresh)
		return this.getDiscoveredInstances();
	}
}
