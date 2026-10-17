import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { ConfigureVirtualDewPointDto } from '../dto/dew-point-config.dto';
import { VirtualDewPointModel, VirtualDewPointResponseModel } from '../models/dew-point-response.model';
import { VirtualDewPointConfigService } from '../services/virtual-dew-point-config.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/dew-points')
export class VirtualDewPointConfigController {
	constructor(private readonly configs: VirtualDewPointConfigService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read dew point configuration',
		description:
			'Dedicated dry-bulb and relative-humidity producer. Missing inputs remain visible. Preview grants no live authority or installed cooling qualification.',
		operationId: 'get-devices-virtual-plugin-dew-point',
	})
	@ApiSuccessResponse(VirtualDewPointResponseModel, 'Dew point configuration')
	@Get(':id')
	async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<VirtualDewPointResponseModel> {
		return this.respond(() => this.configs.get(id));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure dedicated two-input dew point',
		description:
			'Dedicated dry-bulb and relative-humidity producer. Missing inputs remain visible. Preview grants no live authority or installed cooling qualification.',
		operationId: 'configure-devices-virtual-plugin-dew-point',
	})
	@ApiSuccessResponse(VirtualDewPointResponseModel, 'Dew point configuration')
	@Put(':id')
	async configure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualDewPointDto,
	): Promise<VirtualDewPointResponseModel> {
		return this.respond(() => this.configs.configure(id, dto, false));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview dew point source and graph admission',
		description:
			'Dedicated dry-bulb and relative-humidity producer. Missing inputs remain visible. Preview grants no live authority or installed cooling qualification.',
		operationId: 'preview-devices-virtual-plugin-dew-point',
	})
	@ApiSuccessResponse(VirtualDewPointResponseModel, 'Dew point configuration')
	@Post(':id/preview')
	async preview(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualDewPointDto,
	): Promise<VirtualDewPointResponseModel> {
		return this.respond(() => this.configs.configure(id, dto, true));
	}

	private async respond(operation: () => Promise<VirtualDewPointModel>): Promise<VirtualDewPointResponseModel> {
		try {
			const response = new VirtualDewPointResponseModel();
			response.data = await operation();
			return response;
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
