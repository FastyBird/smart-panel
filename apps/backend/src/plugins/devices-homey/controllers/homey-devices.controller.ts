import { Controller, Get, NotFoundException, Param, Query, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

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
import { ListHomeyDevicesQueryDto } from '../dto/list-homey-devices.dto';
import { HomeyInventoryDeviceNotFoundError, HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyInventoryDeviceResponseModel, HomeyInventoryDevicesResponseModel } from '../models/inventory.model';
import { HomeyDeviceInventoryService } from '../services/homey-device-inventory.service';

@ApiTags(DEVICES_HOMEY_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class HomeyDevicesController {
	constructor(private readonly inventoryService: HomeyDeviceInventoryService) {}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'List normalized Homey devices',
		description:
			'Lists the active connector inventory with stable mapping support, availability, zone, and adoption metadata.',
		operationId: 'get-devices-homey-plugin-devices',
	})
	@ApiSuccessResponse(HomeyInventoryDevicesResponseModel, 'Homey device inventory retrieved successfully')
	@ApiBadRequestResponse('Invalid Homey inventory filters')
	@ApiUnprocessableEntityResponse('Homey inventory is not currently available')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	async findAll(@Query() query: ListHomeyDevicesQueryDto): Promise<HomeyInventoryDevicesResponseModel> {
		try {
			const response = new HomeyInventoryDevicesResponseModel();
			response.data = await this.inventoryService.findAll(query);

			return response;
		} catch (error) {
			if (error instanceof HomeyInventoryUnavailableError) {
				throw new UnprocessableEntityException('Homey inventory is not currently available');
			}

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOMEY_PLUGIN_API_TAG_NAME],
		summary: 'Get one normalized Homey device',
		description: 'Returns one device from the active normalized Homey inventory without exposing raw SDK objects.',
		operationId: 'get-devices-homey-plugin-device',
	})
	@ApiParam({ name: 'deviceId', type: 'string', description: 'Authoritative Homey device identifier' })
	@ApiSuccessResponse(HomeyInventoryDeviceResponseModel, 'Homey device retrieved successfully')
	@ApiBadRequestResponse('Invalid Homey device identifier')
	@ApiNotFoundResponse('Homey device not found')
	@ApiUnprocessableEntityResponse('Homey inventory is not currently available')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':deviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	async findOne(@Param('deviceId') deviceId: string): Promise<HomeyInventoryDeviceResponseModel> {
		try {
			const response = new HomeyInventoryDeviceResponseModel();
			response.data = await this.inventoryService.findOne(deviceId);

			return response;
		} catch (error) {
			if (error instanceof HomeyInventoryUnavailableError) {
				throw new UnprocessableEntityException('Homey inventory is not currently available');
			}
			if (error instanceof HomeyInventoryDeviceNotFoundError) {
				throw new NotFoundException('Homey device not found');
			}

			throw error;
		}
	}
}
