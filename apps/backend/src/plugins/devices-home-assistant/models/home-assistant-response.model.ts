import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

import { HomeAssistantDiscoveredDeviceModel, HomeAssistantStateModel } from './home-assistant.model';

/**
 * Response wrapper for HomeAssistantDiscoveredDeviceModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResDiscoveredDevice' })
export class HomeAssistantDiscoveredDeviceResponseModel extends BaseSuccessResponseModel<HomeAssistantDiscoveredDeviceModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => HomeAssistantDiscoveredDeviceModel,
	})
	@Expose()
	@Type(() => HomeAssistantDiscoveredDeviceModel)
	data: HomeAssistantDiscoveredDeviceModel;
}

/**
 * Response wrapper for array of HomeAssistantDiscoveredDeviceModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResDiscoveredDevices' })
export class HomeAssistantDiscoveredDevicesResponseModel extends BaseSuccessResponseModel<
	HomeAssistantDiscoveredDeviceModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantDiscoveredDeviceModel) },
	})
	@Expose()
	@Type(() => HomeAssistantDiscoveredDeviceModel)
	data: HomeAssistantDiscoveredDeviceModel[];
}

/**
 * Response wrapper for HomeAssistantStateModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResState' })
export class HomeAssistantStateResponseModel extends BaseSuccessResponseModel<HomeAssistantStateModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => HomeAssistantStateModel,
	})
	@Expose()
	@Type(() => HomeAssistantStateModel)
	data: HomeAssistantStateModel;
}

/**
 * Response wrapper for array of HomeAssistantStateModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResStates' })
export class HomeAssistantStatesResponseModel extends BaseSuccessResponseModel<HomeAssistantStateModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantStateModel) },
	})
	@Expose()
	@Type(() => HomeAssistantStateModel)
	data: HomeAssistantStateModel[];
}
