import { Body, Controller, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiCreatedSuccessResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import { VirtualCreatedThermostatResponseModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationResponseModel } from '../models/thermostat-response.model';
import { VirtualThermostatAuthoringService } from '../services/virtual-thermostat-authoring.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/thermostats')
export class VirtualThermostatAuthoringController {
	constructor(private readonly authoring: VirtualThermostatAuthoringService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Create climate controller thermostat',
		description:
			'Create a complete thermostat graph, source policy, local settings and exclusive actuator claims in one admitted writer.',
		operationId: 'create-devices-virtual-plugin-thermostat-producer',
	})
	@ApiUnprocessableEntityResponse('Proposed graph, source, claim, policy or revision is invalid')
	@ApiCreatedSuccessResponse(VirtualCreatedThermostatResponseModel, 'Create thermostat')
	@Post()
	async create(@Body() dto: CreateVirtualThermostatProducerDto): Promise<VirtualCreatedThermostatResponseModel> {
		const response = new VirtualCreatedThermostatResponseModel();
		response.data = await this.execute(() => this.authoring.create(dto));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview climate controller thermostat',
		description:
			'Validate a proposed thermostat, bindings and reservations through metadata only, without catalog writes or runtime effects.',
		operationId: 'preview-devices-virtual-plugin-thermostat-draft',
	})
	@ApiUnprocessableEntityResponse('Proposed graph, source, claim, policy or revision is invalid')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Preview thermostat')
	@Post('draft-preview')
	async preview(@Body() dto: CreateVirtualThermostatProducerDto): Promise<VirtualThermostatConfigurationResponseModel> {
		const response = new VirtualThermostatConfigurationResponseModel();
		response.data = await this.execute(() => this.authoring.preview(dto));
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
