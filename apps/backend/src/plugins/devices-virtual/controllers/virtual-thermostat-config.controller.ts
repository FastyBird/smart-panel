import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { ConfigureVirtualThermostatDto, RequestVirtualThermostatReleaseDto } from '../dto/thermostat-config.dto';
import {
	VirtualThermostatConfigurationModel,
	VirtualThermostatConfigurationResponseModel,
	VirtualThermostatRuntimeModel,
	VirtualThermostatRuntimeResponseModel,
} from '../models/thermostat-response.model';
import { VirtualThermostatConfigService } from '../services/virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from '../services/virtual-thermostat-runtime.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers')
export class VirtualThermostatConfigController {
	constructor(
		private readonly configs: VirtualThermostatConfigService,
		private readonly runtime: VirtualThermostatRuntimeService,
	) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat runtime',
		description:
			'Read requested comfort intent, qualified measurements, physical branch activity and independent inhibit reasons.',
		operationId: 'get-devices-virtual-plugin-thermostat-runtime',
	})
	@ApiSuccessResponse(VirtualThermostatRuntimeResponseModel, 'Thermostat runtime')
	@Get('thermostats/:id/runtime')
	async getRuntime(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualThermostatRuntimeResponseModel> {
		const runtime = await this.runtime.inspect(id);
		if (!runtime) throw new NotFoundException('Thermostat configuration does not exist.');
		const response = new VirtualThermostatRuntimeResponseModel();
		response.data = Object.assign(new VirtualThermostatRuntimeModel(), runtime);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat configuration',
		description: 'Read role-aware sources, persistent reservations, registered settings and activation blockers.',
		operationId: 'get-devices-virtual-plugin-thermostat-configuration',
	})
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Thermostat configuration')
	@Get('thermostats/:id')
	async get(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.get(id));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure thermostat',
		description:
			'Atomically validate configuration, register local settings and reserve canonical physical actuator leaves. Authoring remains draft until installed hardware qualification and durable runtime reconciliation.',
		operationId: 'configure-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Policy, reservation, source or revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Durable thermostat configuration')
	@Put('thermostats/:id')
	async configure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualThermostatDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.configure(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview thermostat configuration',
		description:
			'Run the same configuration and ownership checks without reserving hardware or changing local permissions.',
		operationId: 'preview-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Policy, reservation, source or revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Proposed thermostat configuration')
	@Post('thermostats/:id/preview')
	async preview(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualThermostatDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.preview(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Request thermostat actuator release',
		description:
			'Persist user OFF and prioritized release demand while retaining every reservation. Dispatch acceptance, timeout and unrelated OFF readback do not free hardware.',
		operationId: 'release-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Configuration revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Pending release and retained reservations')
	@Post('thermostats/:id/release')
	async release(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: RequestVirtualThermostatReleaseDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.requestRelease(id, dto.expectedRevision));
	}

	private async response(
		operation: () => Promise<Awaited<ReturnType<VirtualThermostatConfigService['get']>>>,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		try {
			const response = new VirtualThermostatConfigurationResponseModel();
			response.data = Object.assign(new VirtualThermostatConfigurationModel(), await operation());
			return response;
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
