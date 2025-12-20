import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_WLED_API_TAG_NAME } from '../devices-wled.constants';
import { WledDiscoveredDeviceModel, WledDiscoveredDevicesResponseModel } from '../models/wled-discovery.model';
import { WledService } from '../services/wled.service';

@ApiTags(DEVICES_WLED_API_TAG_NAME)
@Controller('discovery')
export class WledDiscoveryController {
	private readonly logger = new Logger(WledDiscoveryController.name);

	constructor(private readonly wledService: WledService) {}

	@ApiOperation({
		tags: [DEVICES_WLED_API_TAG_NAME],
		summary: 'Get discovered WLED devices',
		description:
			'Returns a list of WLED devices discovered via mDNS that have not yet been added to the system. ' +
			'These devices can be manually added through the device creation endpoint.',
		operationId: 'get-devices-wled-plugin-discovered',
	})
	@ApiSuccessResponse(
		WledDiscoveredDevicesResponseModel,
		'List of discovered WLED devices not yet added to the system.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getDiscoveredDevices(): Promise<WledDiscoveredDevicesResponseModel> {
		this.logger.debug('[WLED][DISCOVERY CONTROLLER] Incoming request to get discovered WLED devices');

		const discoveredDevices = await this.wledService.getUnadedDiscoveredDevices();

		const devices: WledDiscoveredDeviceModel[] = discoveredDevices.map((device) =>
			toInstance(WledDiscoveredDeviceModel, {
				host: device.host,
				name: device.name,
				mac: device.mac ?? null,
				port: device.port,
			}),
		);

		const response = new WledDiscoveredDevicesResponseModel();
		response.data = devices;

		return response;
	}
}
