import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_ZIGBEE2MQTT_API_TAG_NAME } from '../devices-zigbee2mqtt.constants';
import {
	Zigbee2mqttBridgeStatusModel,
	Zigbee2mqttBridgeStatusResponseModel,
} from '../models/zigbee2mqtt-response.model';
import { Zigbee2mqttService } from '../services/zigbee2mqtt.service';

@ApiTags(DEVICES_ZIGBEE2MQTT_API_TAG_NAME)
@Controller('bridge')
export class Zigbee2mqttBridgeController {
	constructor(private readonly zigbee2mqttService: Zigbee2mqttService) {}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Retrieve the Zigbee2MQTT bridge status',
		description:
			'Returns whether the bridge is online and the bridge settings that decide how fresh Zigbee values can be ' +
			'(`last_seen`, `cache_state`, `cache_state_send_on_startup`, `retain`), so the admin can recommend them.',
		operationId: 'get-devices-zigbee2mqtt-plugin-bridge',
	})
	@ApiSuccessResponse(Zigbee2mqttBridgeStatusResponseModel, 'The bridge status was successfully retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	getStatus(): Zigbee2mqttBridgeStatusResponseModel {
		const settings = this.zigbee2mqttService.getBridgeSettings();
		const response = new Zigbee2mqttBridgeStatusResponseModel();
		response.data = toInstance(Zigbee2mqttBridgeStatusModel, {
			online: this.zigbee2mqttService.isBridgeOnline(),
			connectionType: this.zigbee2mqttService.getConnectionType(),
			settings: settings ? { ...settings } : null,
		});
		return response;
	}
}
