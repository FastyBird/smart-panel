import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { PreviewVirtualTransformDto } from '../dto/measurement-authoring.dto';
import { ConfigureVirtualTransformDto } from '../dto/transform-config.dto';
import { NumericOperatorModel, NumericOperatorsResponseModel } from '../models/numeric-operator.model';
import { VirtualTransformConfigurationResponseModel } from '../models/transform-response.model';
import { VirtualTransformConfigService } from '../services/virtual-transform-config.service';
import { attachTransformPreview } from '../services/virtual-transform-preview.utils';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers')
export class VirtualTransformConfigController {
	constructor(private readonly configs: VirtualTransformConfigService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'List trusted numeric operators',
		description:
			'Available exact operator versions with canonical measurements, domains and finite numeric parameter schemas. Preview grants no live authority.',
		operationId: 'get-devices-virtual-plugin-numeric-operators',
	})
	@ApiSuccessResponse(NumericOperatorsResponseModel, 'Available numeric operators')
	@Get('numeric-operators')
	operators(): NumericOperatorsResponseModel {
		const response = new NumericOperatorsResponseModel();
		response.data = (this.configs.resolver.registry?.catalogue() ?? []).map((descriptor) =>
			Object.assign(new NumericOperatorModel(), descriptor),
		);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read transform configuration',
		description:
			'Read durable policy and input diagnostics, including missing source identities. Diagnostics include the input, output, quality and conversion failure.',
		operationId: 'get-devices-virtual-plugin-transform-configuration',
	})
	@ApiUnprocessableEntityResponse('Producer policy, binding or revision is invalid')
	@ApiSuccessResponse(VirtualTransformConfigurationResponseModel, 'Transform configuration')
	@Get('transforms/:id')
	async get(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualTransformConfigurationResponseModel> {
		const response = new VirtualTransformConfigurationResponseModel();
		response.data = await this.execute(() => this.configs.get(id));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure transform producer',
		description:
			'Atomically validate and persist versioned transform policy, stable typed input bindings and graph revision. Invalidates the previous lease; qualified fresh source evidence activates evaluation.',
		operationId: 'configure-devices-virtual-plugin-transform',
	})
	@ApiUnprocessableEntityResponse('Producer policy, binding or revision is invalid')
	@ApiSuccessResponse(VirtualTransformConfigurationResponseModel, 'Durable transform configuration')
	@Put('transforms/:id')
	async configure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualTransformDto,
	): Promise<VirtualTransformConfigurationResponseModel> {
		const response = new VirtualTransformConfigurationResponseModel();
		response.data = await this.execute(() => this.configs.configure(id, dto));
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview transform configuration',
		description:
			'Run the same policy, ownership, source and dependency checks as persistence without writing or reserving a revision. The subsequent write revalidates under database writer admission.',
		operationId: 'preview-devices-virtual-plugin-transform',
	})
	@ApiUnprocessableEntityResponse('Producer policy, binding or revision is invalid')
	@ApiSuccessResponse(VirtualTransformConfigurationResponseModel, 'Proposed transform configuration')
	@Post('transforms/:id/preview')
	async preview(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: PreviewVirtualTransformDto,
	): Promise<VirtualTransformConfigurationResponseModel> {
		const response = new VirtualTransformConfigurationResponseModel();
		response.data = attachTransformPreview(
			await this.execute(() => this.configs.preview(id, dto)),
			dto.previewInput,
			this.configs.resolver,
		);
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
