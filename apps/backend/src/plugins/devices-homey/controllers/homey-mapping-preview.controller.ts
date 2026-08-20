import { Body, Controller, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_HOMEY_PLUGIN_API_TAG_NAME } from '../devices-homey.constants';
import { HomeyMappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import {
	HomeyMappingPreviewDeviceNotFoundError,
	HomeyMappingPreviewUnavailableError,
} from '../errors/homey-mapping-preview.error';
import { HomeyMappingPreviewResponseModel } from '../models/mapping-preview.model';
import { HomeyMappingPreviewService } from '../services/homey-mapping-preview.service';

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller('mapping-preview')
export class HomeyMappingPreviewController {
	constructor(private readonly mappingPreviewService: HomeyMappingPreviewService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Preview a Homey device mapping',
		description:
			'Fetches one fresh normalized Homey device and returns deterministic proposed channels, properties, conversions, category alternatives, and warnings without mutating either system.',
		operationId: 'preview-devices-homey-plugin-device-mapping',
	})
	@ApiBody({ type: HomeyMappingPreviewRequestDto, description: 'Homey device and optional category selection' })
	@ApiSuccessResponse(HomeyMappingPreviewResponseModel, 'Homey mapping preview generated successfully')
	@ApiBadRequestResponse('Invalid Homey mapping preview request')
	@ApiNotFoundResponse('Homey mapping preview device not found')
	@ApiUnprocessableEntityResponse('Homey mapping preview is not currently available')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async preview(@Body() body: HomeyMappingPreviewRequestDto): Promise<HomeyMappingPreviewResponseModel> {
		try {
			const response = new HomeyMappingPreviewResponseModel();
			response.data = await this.mappingPreviewService.generatePreview(body);

			return response;
		} catch (error) {
			if (error instanceof HomeyMappingPreviewDeviceNotFoundError) {
				throw new NotFoundException('Homey mapping preview device not found');
			}
			if (error instanceof HomeyMappingPreviewUnavailableError) {
				throw new UnprocessableEntityException('Homey mapping preview is not currently available');
			}

			throw error;
		}
	}
}
