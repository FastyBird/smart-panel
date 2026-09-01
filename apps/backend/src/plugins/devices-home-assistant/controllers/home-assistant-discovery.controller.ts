import { BadRequestException, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import {
	ApiBadRequestResponse,
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

	constructor(
		private readonly discovererService: HaMdnsDiscovererService,
		private readonly managedServiceManager: ManagedServiceManagerService,
	) {}

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
	getDiscoveredInstances(): DiscoveredInstancesResponseModel {
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
	@ApiBadRequestResponse('Home Assistant discovery could not be refreshed')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('refresh')
	async refreshDiscovery(): Promise<DiscoveredInstancesResponseModel> {
		const extensionKind = 'plugin';
		const serviceId = 'discovery';
		const current = await this.managedServiceManager.getServiceStatus(
			extensionKind,
			DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			serviceId,
		);
		const refreshed =
			current?.state === 'stopped'
				? await this.managedServiceManager.startServiceManually(
						extensionKind,
						DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
						serviceId,
					)
				: await this.managedServiceManager.restartService(extensionKind, DEVICES_HOME_ASSISTANT_PLUGIN_NAME, serviceId);

		if (!refreshed) {
			throw new BadRequestException('Home Assistant discovery could not be refreshed');
		}

		// Return current list - existing instances are preserved while discovery restarts
		return this.getDiscoveredInstances();
	}
}
