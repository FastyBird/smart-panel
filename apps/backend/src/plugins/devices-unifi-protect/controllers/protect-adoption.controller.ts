import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME } from '../devices-unifi-protect.constants';
import { ProtectReqAdoptDeviceDto, ProtectReqBatchAdoptDevicesDto } from '../dto/protect-adoption.dto';
import { ProtectReqMappingPreviewDto } from '../dto/protect-mapping-preview.dto';
import {
	ProtectAdoptionResponseModel,
	ProtectBatchAdoptionModel,
	ProtectBatchAdoptionResponseModel,
} from '../models/protect-adoption.model';
import { ProtectMappingPreviewResponseModel } from '../models/protect-mapping-preview.model';
import { ProtectAdoptionService } from '../services/protect-adoption.service';
import { ProtectMappingPreviewService } from '../services/protect-mapping-preview.service';

import { translate } from './protect-error-translation';

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller()
export class ProtectAdoptionController {
	constructor(
		private readonly previews: ProtectMappingPreviewService,
		private readonly adoption: ProtectAdoptionService,
	) {}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Preview the mapping of a UniFi Protect device',
		description:
			'Reads the device from the console and returns the Smart Panel channels and properties adoption would create, with warnings. Nothing is created and no console setting changes.',
		operationId: 'create-devices-unifi-protect-plugin-mapping-preview',
	})
	@ApiBody({ type: ProtectReqMappingPreviewDto })
	@ApiSuccessResponse(ProtectMappingPreviewResponseModel, 'UniFi Protect mapping preview created successfully')
	@ApiBadRequestResponse('Invalid device identifier or model key')
	@ApiNotFoundResponse('UniFi Protect device not found')
	@ApiUnprocessableEntityResponse('The UniFi Protect device has no supported mapping')
	@ApiServiceUnavailableResponse('The UniFi Protect console is not connected')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('mapping-preview')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async previewMapping(@Body() body: ProtectReqMappingPreviewDto): Promise<ProtectMappingPreviewResponseModel> {
		try {
			const response = new ProtectMappingPreviewResponseModel();
			response.data = await this.previews.preview(body.data.deviceId, body.data.modelKey);

			return response;
		} catch (error) {
			throw translate(error);
		}
	}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Adopt a UniFi Protect device',
		description:
			'Creates or reconciles the Smart Panel device for one UniFi Protect device. Adoption is idempotent: an adopted device is updated in place and keeps its identifiers. The response is always 200 with the outcome in the result.',
		operationId: 'create-devices-unifi-protect-plugin-adoption',
	})
	@ApiBody({ type: ProtectReqAdoptDeviceDto })
	@ApiSuccessResponse(ProtectAdoptionResponseModel, 'UniFi Protect device adoption processed successfully')
	@ApiBadRequestResponse('Invalid adoption request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async adopt(@Body() body: ProtectReqAdoptDeviceDto): Promise<ProtectAdoptionResponseModel> {
		const response = new ProtectAdoptionResponseModel();
		response.data = await this.adoption.adoptOne(body.data);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Adopt several UniFi Protect devices',
		description:
			'Adopts up to 50 devices one after another in request order. A failing device does not stop the others; every device has its own outcome in the 200 response.',
		operationId: 'create-devices-unifi-protect-plugin-batch-adoption',
	})
	@ApiBody({ type: ProtectReqBatchAdoptDevicesDto })
	@ApiSuccessResponse(ProtectBatchAdoptionResponseModel, 'UniFi Protect batch adoption processed successfully')
	@ApiBadRequestResponse('Invalid adoption request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt/batch')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async adoptBatch(@Body() body: ProtectReqBatchAdoptDevicesDto): Promise<ProtectBatchAdoptionResponseModel> {
		const response = new ProtectBatchAdoptionResponseModel();
		response.data = Object.assign(new ProtectBatchAdoptionModel(), {
			results: await this.adoption.adoptBatch(body.data.devices),
		});

		return response;
	}
}
