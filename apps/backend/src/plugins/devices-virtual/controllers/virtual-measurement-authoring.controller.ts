import { Body, Controller, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiCreatedSuccessResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import {
	CreateVirtualAggregateProducerDto,
	CreateVirtualTransformProducerDto,
	PreviewVirtualTransformProducerDto,
} from '../dto/measurement-authoring.dto';
import {
	VirtualCreatedAggregateResponseModel,
	VirtualCreatedTransformResponseModel,
} from '../models/measurement-authoring-response.model';
import { VirtualAggregateConfigurationResponseModel } from '../models/producer-response.model';
import { VirtualTransformConfigurationResponseModel } from '../models/transform-response.model';
import { VirtualMeasurementAuthoringService } from '../services/virtual-measurement-authoring.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers')
export class VirtualMeasurementAuthoringController {
	constructor(private readonly authoring: VirtualMeasurementAuthoringService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Create aggregate measurement',
		description: 'Create device, output, membership and policy in one admitted writer; publish only after commit.',
		operationId: 'create-devices-virtual-plugin-aggregate-producer',
	})
	@ApiUnprocessableEntityResponse('Proposed device, source, policy or revision is invalid')
	@ApiCreatedSuccessResponse(VirtualCreatedAggregateResponseModel, 'Create aggregate measurement')
	@Post('aggregates')
	async createAggregate(@Body() dto: CreateVirtualAggregateProducerDto): Promise<VirtualCreatedAggregateResponseModel> {
		const response = new VirtualCreatedAggregateResponseModel();
		response.data = await this.execute(() => this.authoring.createAggregate(dto));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Create numeric transform measurement',
		description:
			'Create device, output, physical source and policy atomically; never seed a value or qualify historical evidence.',
		operationId: 'create-devices-virtual-plugin-transform-producer',
	})
	@ApiUnprocessableEntityResponse('Proposed device, source, policy or revision is invalid')
	@ApiCreatedSuccessResponse(VirtualCreatedTransformResponseModel, 'Create numeric transform measurement')
	@Post('transforms')
	async createTransform(@Body() dto: CreateVirtualTransformProducerDto): Promise<VirtualCreatedTransformResponseModel> {
		const response = new VirtualCreatedTransformResponseModel();
		response.data = await this.execute(() => this.authoring.createTransform(dto));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview proposed aggregate measurement',
		description:
			'Validate proposed sensor slots, source membership, policy and graph without inserting rows or advancing revisions.',
		operationId: 'preview-devices-virtual-plugin-aggregate-draft',
	})
	@ApiUnprocessableEntityResponse('Proposed device, source, policy or revision is invalid')
	@ApiSuccessResponse(VirtualAggregateConfigurationResponseModel, 'Preview proposed aggregate measurement')
	@Post('aggregates/draft-preview')
	async previewAggregate(
		@Body() dto: CreateVirtualAggregateProducerDto,
	): Promise<VirtualAggregateConfigurationResponseModel> {
		const response = new VirtualAggregateConfigurationResponseModel();
		response.data = await this.execute(() => this.authoring.previewAggregate(dto));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview proposed numeric transform',
		description:
			'Validate the same policy and units as persistence; optionally convert supplied hypothetical input without storage, samples or qualification.',
		operationId: 'preview-devices-virtual-plugin-transform-draft',
	})
	@ApiUnprocessableEntityResponse('Proposed device, source, policy or revision is invalid')
	@ApiSuccessResponse(VirtualTransformConfigurationResponseModel, 'Preview proposed numeric transform')
	@Post('transforms/draft-preview')
	async previewTransform(
		@Body() dto: PreviewVirtualTransformProducerDto,
	): Promise<VirtualTransformConfigurationResponseModel> {
		const response = new VirtualTransformConfigurationResponseModel();
		response.data = await this.execute(() => this.authoring.previewTransform(dto));
		return response;
	}

	private async execute<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
