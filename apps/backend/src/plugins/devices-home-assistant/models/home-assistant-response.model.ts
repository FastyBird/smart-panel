import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import {
	HomeAssistantDeviceRegistryResponseResultModel,
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantEntityRegistryResponseResultModel,
	HomeAssistantStateModel,
} from './home-assistant.model';

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
	declare data: HomeAssistantDiscoveredDeviceModel;
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
	declare data: HomeAssistantDiscoveredDeviceModel[];
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
	declare data: HomeAssistantStateModel;
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
	declare data: HomeAssistantStateModel[];
}

/**
 * Response wrapper for array of HomeAssistantDeviceRegistryResponseResultModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResDeviceRegistry' })
export class HomeAssistantDeviceRegistryResponseModel extends BaseSuccessResponseModel<
	HomeAssistantDeviceRegistryResponseResultModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantDeviceRegistryResponseResultModel) },
	})
	@Expose()
	declare data: HomeAssistantDeviceRegistryResponseResultModel[];
}

/**
 * Response wrapper for array of HomeAssistantEntityRegistryResponseResultModel
 */
@ApiSchema({ name: 'DevicesHomeAssistantPluginResEntityRegistry' })
export class HomeAssistantEntityRegistryResponseModel extends BaseSuccessResponseModel<
	HomeAssistantEntityRegistryResponseResultModel[]
> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantEntityRegistryResponseResultModel) },
	})
	@Expose()
	declare data: HomeAssistantEntityRegistryResponseResultModel[];
}
