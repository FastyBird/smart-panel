import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME, DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualSourceDevicesResponseModel } from '../models/virtual-response.model';
import { VirtualDevicesService } from '../services/virtual-devices.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class VirtualDevicesController {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDevicesController');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly virtualDevicesService: VirtualDevicesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'List the physical devices behind a virtual device',
		description:
			"Fetches the distinct physical devices that the specified virtual device's linked properties currently draw their values from. A virtual device built only from owned (synthesized) properties returns an empty list.",
		operationId: 'get-devices-virtual-plugin-device-source-devices',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Virtual device ID' })
	@ApiSuccessResponse(VirtualSourceDevicesResponseModel, 'The distinct source devices behind the virtual device.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/source-devices')
	async findSourceDevices(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualSourceDevicesResponseModel> {
		this.logger.debug(`Fetching source devices for virtual device id=${id}`);

		const device = await this.devicesService.findOne(id);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		const sourceDevices = await this.virtualDevicesService.findSourceDevices(id);

		this.logger.debug(`Found ${sourceDevices.length} source device(s) for virtual device id=${id}`);

		const response = new VirtualSourceDevicesResponseModel();

		response.data = sourceDevices;

		return response;
	}
}
