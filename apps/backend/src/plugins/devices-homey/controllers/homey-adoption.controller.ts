import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_HOMEY_PLUGIN_API_TAG_NAME } from '../devices-homey.constants';
import { HomeyAdoptDeviceDto, HomeyBatchAdoptDevicesDto } from '../dto/adoption.dto';
import {
	HomeyAdoptionResponseModel,
	HomeyBatchAdoptionModel,
	HomeyBatchAdoptionResponseModel,
} from '../models/adoption.model';
import { HomeyDeviceAdoptionService } from '../services/homey-device-adoption.service';

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller('adopt')
export class HomeyAdoptionController {
	constructor(private readonly adoptionService: HomeyDeviceAdoptionService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Adopt one Homey device',
		description:
			'Re-fetches the selected Homey device, validates its current mapping, and idempotently creates or reconciles the corresponding Smart Panel device hierarchy.',
		operationId: 'create-devices-homey-plugin-adoption',
	})
	@ApiBody({ type: HomeyAdoptDeviceDto, description: 'Homey device selection' })
	@ApiSuccessResponse(HomeyAdoptionResponseModel, 'Homey device adoption completed')
	@ApiBadRequestResponse('Invalid Homey adoption request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Post()
	async adopt(@Body() body: HomeyAdoptDeviceDto): Promise<HomeyAdoptionResponseModel> {
		const response = new HomeyAdoptionResponseModel();
		response.data = await this.adoptionService.adoptOne(body);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Adopt a batch of Homey devices',
		description:
			'Adopts each selected Homey device independently and returns ordered per-device results, so one failure does not discard successful selections.',
		operationId: 'create-devices-homey-plugin-batch-adoption',
	})
	@ApiBody({ type: HomeyBatchAdoptDevicesDto, description: 'Homey device selections' })
	@ApiSuccessResponse(HomeyBatchAdoptionResponseModel, 'Homey batch adoption completed')
	@ApiBadRequestResponse('Invalid Homey batch adoption request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@Post('batch')
	async adoptBatch(@Body() body: HomeyBatchAdoptDevicesDto): Promise<HomeyBatchAdoptionResponseModel> {
		const data = new HomeyBatchAdoptionModel();
		data.results = await this.adoptionService.adoptBatch(body.devices);

		const response = new HomeyBatchAdoptionResponseModel();
		response.data = data;

		return response;
	}
}
