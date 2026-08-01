import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	DEVICES_VIRTUAL_PLUGIN_NAME,
	DEVICES_VIRTUAL_TYPE,
} from '../devices-virtual.constants';
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
			"Fetches the distinct physical devices that the specified virtual device's linked properties currently draw their values from. A virtual device built only from owned (synthesized) properties returns an empty list. Devices of any other type are rejected, so an empty list always means the virtual device genuinely draws from nothing.",
		operationId: 'get-devices-virtual-plugin-device-source-devices',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Virtual device ID' })
	@ApiSuccessResponse(VirtualSourceDevicesResponseModel, 'The distinct source devices behind the virtual device.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Device is not a virtual device')
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

		// An ordinary physical device has no source properties either, so without this it would answer
		// `data: []` — a successful, and completely misleading, response: byte-for-byte what a real
		// virtual device assembled purely from owned properties returns. Distinguishing the two is the
		// whole point, because only one of them means "this device draws from nothing".
		//
		// 422 rather than 404: the id resolves to a device that genuinely exists, so reporting it as
		// missing would be a lie of a different kind, and the request is well-formed enough that 400
		// does not fit either. This is the codebase's established split for a resource whose *type*
		// makes an operation invalid — see SpacesSignageInfoPanelValidationException on the
		// space-type-scoped announcements routes, and DevicesValidationException for a space that is a
		// zone where a room was required; both surface as UnprocessableEntityException. Deliberately
		// not `devicesService.findOne(id, DEVICES_VIRTUAL_TYPE)`, which would collapse wrong-type into
		// the null branch above and answer 404 for a device the caller can see in the device list.
		if (device.type !== DEVICES_VIRTUAL_TYPE) {
			this.logger.error(`[ERROR] Device with id=${id} is of type '${device.type}', not a virtual device`);

			throw new UnprocessableEntityException('Requested device is not a virtual device');
		}

		const sourceDevices = await this.virtualDevicesService.findSourceDevices(id);

		this.logger.debug(`Found ${sourceDevices.length} source device(s) for virtual device id=${id}`);

		const response = new VirtualSourceDevicesResponseModel();

		response.data = sourceDevices;

		return response;
	}
}
