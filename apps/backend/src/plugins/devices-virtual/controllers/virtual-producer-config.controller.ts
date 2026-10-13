import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { ConfigureVirtualAggregateDto, ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualAggregateConfigurationResponseModel,
	VirtualLightGroupConfigurationResponseModel,
} from '../models/producer-response.model';
import { VirtualProducerConfigService } from '../services/virtual-producer-config.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers')
export class VirtualProducerConfigController {
	constructor(private readonly configs: VirtualProducerConfigService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read aggregate configuration',
		description:
			'Read durable policy and input diagnostics, including missing source identities. Runtime readiness remains unavailable until the aggregate evaluator is delivered.',
		operationId: 'get-devices-virtual-plugin-aggregate-configuration',
	})
	@ApiSuccessResponse(VirtualAggregateConfigurationResponseModel, 'Aggregate configuration')
	@Get('aggregates/:id')
	async getAggregate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualAggregateConfigurationResponseModel> {
		const response = new VirtualAggregateConfigurationResponseModel();
		response.data = await this.configs.getAggregate(id);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure aggregate producer',
		description:
			'Atomically validate and persist versioned aggregate policy, stable typed input bindings and graph revision. Does not activate runtime evaluation.',
		operationId: 'configure-devices-virtual-plugin-aggregate',
	})
	@ApiSuccessResponse(VirtualAggregateConfigurationResponseModel, 'Durable aggregate configuration')
	@Put('aggregates/:id')
	async configureAggregate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationResponseModel> {
		const response = new VirtualAggregateConfigurationResponseModel();
		response.data = await this.configs.configureAggregate(id, dto);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview aggregate configuration',
		description:
			'Run the same policy, ownership, source and dependency checks as persistence without writing or reserving a revision. The subsequent write revalidates under database writer admission.',
		operationId: 'preview-devices-virtual-plugin-aggregate',
	})
	@ApiSuccessResponse(VirtualAggregateConfigurationResponseModel, 'Proposed aggregate configuration')
	@Post('aggregates/:id/preview')
	async previewAggregate(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationResponseModel> {
		const response = new VirtualAggregateConfigurationResponseModel();
		response.data = await this.configs.previewAggregate(id, dto);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read light group configuration',
		description:
			'Read durable physical light membership and property bindings. Missing members retain original identities. Runtime readiness remains unavailable until group evaluation/dispatch is delivered.',
		operationId: 'get-devices-virtual-plugin-light-group-configuration',
	})
	@ApiSuccessResponse(VirtualLightGroupConfigurationResponseModel, 'Light group configuration')
	@Get('light-groups/:id')
	async getGroup(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualLightGroupConfigurationResponseModel> {
		const response = new VirtualLightGroupConfigurationResponseModel();
		response.data = await this.configs.getLightGroup(id);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure light group producer',
		description:
			'Atomically validate and persist typed physical-light members, common exposed property bindings and graph revision. Does not activate group commands.',
		operationId: 'configure-devices-virtual-plugin-light-group',
	})
	@ApiSuccessResponse(VirtualLightGroupConfigurationResponseModel, 'Durable light group configuration')
	@Put('light-groups/:id')
	async configureGroup(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationResponseModel> {
		const response = new VirtualLightGroupConfigurationResponseModel();
		response.data = await this.configs.configureLightGroup(id, dto);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview light group configuration',
		description:
			'Run the same membership, source-property and dependency checks as persistence without writing. The subsequent write revalidates under database writer admission.',
		operationId: 'preview-devices-virtual-plugin-light-group',
	})
	@ApiSuccessResponse(VirtualLightGroupConfigurationResponseModel, 'Proposed light group configuration')
	@Post('light-groups/:id/preview')
	async previewGroup(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationResponseModel> {
		const response = new VirtualLightGroupConfigurationResponseModel();
		response.data = await this.configs.previewLightGroup(id, dto);
		return response;
	}
}
