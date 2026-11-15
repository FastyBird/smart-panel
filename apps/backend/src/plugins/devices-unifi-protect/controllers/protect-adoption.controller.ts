import {
	Body,
	Controller,
	HttpCode,
	NotFoundException,
	Post,
	ServiceUnavailableException,
	UnprocessableEntityException,
} from '@nestjs/common';
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
import { ProtectReqMappingPreviewDto } from '../dto/protect-mapping-preview.dto';
import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';
import { ProtectMappingPreviewResponseModel } from '../models/protect-mapping-preview.model';
import { ProtectMappingPreviewService } from '../services/protect-mapping-preview.service';

const translate = (error: unknown): unknown => {
	if (error instanceof ProtectConsoleUnavailableError) {
		return new ServiceUnavailableException('The UniFi Protect console is not connected');
	}

	if (error instanceof ProtectDeviceNotFoundError) {
		return new NotFoundException('UniFi Protect device not found');
	}

	if (error instanceof ProtectUnsupportedDeviceError) {
		return new UnprocessableEntityException('The UniFi Protect device has no supported mapping');
	}

	return error;
};

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller()
export class ProtectAdoptionController {
	constructor(private readonly previews: ProtectMappingPreviewService) {}

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
}
