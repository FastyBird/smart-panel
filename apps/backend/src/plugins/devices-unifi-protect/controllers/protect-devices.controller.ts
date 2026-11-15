import {
	BadRequestException,
	Controller,
	Get,
	NotFoundException,
	Param,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import { DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME } from '../devices-unifi-protect.constants';
import { ProtectConsoleUnavailableError, ProtectDeviceNotFoundError } from '../errors/protect-adoption.error';
import {
	ProtectInventoryDeviceResponseModel,
	ProtectInventoryDevicesResponseModel,
} from '../models/protect-inventory.model';
import { ProtectInventoryService } from '../services/protect-inventory.service';

const translate = (error: unknown): unknown => {
	if (error instanceof ProtectConsoleUnavailableError) {
		return new ServiceUnavailableException('The UniFi Protect console is not connected');
	}

	if (error instanceof ProtectDeviceNotFoundError) {
		return new NotFoundException('UniFi Protect device not found');
	}

	return error;
};

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class ProtectDevicesController {
	constructor(private readonly inventoryService: ProtectInventoryService) {}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'List UniFi Protect devices',
		description:
			'Reads cameras, doorbells, sensors and floodlights from the connected console with mapping support and adoption state.',
		operationId: 'get-devices-unifi-protect-plugin-devices',
	})
	@ApiSuccessResponse(ProtectInventoryDevicesResponseModel, 'UniFi Protect device inventory retrieved successfully')
	@ApiServiceUnavailableResponse('The UniFi Protect console is not connected')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async findAll(): Promise<ProtectInventoryDevicesResponseModel> {
		try {
			const response = new ProtectInventoryDevicesResponseModel();
			response.data = await this.inventoryService.findAll();

			return response;
		} catch (error) {
			throw translate(error);
		}
	}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Get one UniFi Protect device',
		description: 'Returns one device from the connected console with mapping support and adoption state.',
		operationId: 'get-devices-unifi-protect-plugin-device',
	})
	@ApiParam({ name: 'deviceId', type: 'string', description: 'UniFi Protect device identifier' })
	@ApiSuccessResponse(ProtectInventoryDeviceResponseModel, 'UniFi Protect device retrieved successfully')
	@ApiBadRequestResponse('Invalid UniFi Protect device identifier')
	@ApiNotFoundResponse('UniFi Protect device not found')
	@ApiServiceUnavailableResponse('The UniFi Protect console is not connected')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':deviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async findOne(@Param('deviceId') deviceId: string): Promise<ProtectInventoryDeviceResponseModel> {
		if (!PROTECT_ID_PATTERN.test(deviceId)) {
			throw new BadRequestException('Invalid UniFi Protect device identifier');
		}

		try {
			const response = new ProtectInventoryDeviceResponseModel();
			response.data = await this.inventoryService.findOne(deviceId);

			return response;
		} catch (error) {
			throw translate(error);
		}
	}
}
