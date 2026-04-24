import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import {
	ShellyNgDeviceInfoModel,
	ShellyNgDiscoverySessionModel,
	ShellyNgMappingReloadModel,
	ShellyNgSupportedDeviceModel,
} from './shelly-ng.model';

/**
 * Response wrapper for ShellyNgDeviceInfoModel
 */
@ApiSchema({ name: 'DevicesShellyNgPluginResDeviceInfo' })
export class ShellyNgDeviceInfoResponseModel extends BaseSuccessResponseModel<ShellyNgDeviceInfoModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ShellyNgDeviceInfoModel,
	})
	@Expose()
	declare data: ShellyNgDeviceInfoModel;
}

/**
 * Response wrapper for array of ShellyNgSupportedDeviceModel
 */
@ApiSchema({ name: 'DevicesShellyNgPluginResSupportedDevices' })
export class ShellyNgSupportedDevicesResponseModel extends BaseSuccessResponseModel<ShellyNgSupportedDeviceModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyNgSupportedDeviceModel) },
	})
	@Expose()
	declare data: ShellyNgSupportedDeviceModel[];
}

/**
 * Response wrapper for ShellyNgDiscoverySessionModel
 */
@ApiSchema({ name: 'DevicesShellyNgPluginResDiscoverySession' })
export class ShellyNgDiscoverySessionResponseModel extends BaseSuccessResponseModel<ShellyNgDiscoverySessionModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ShellyNgDiscoverySessionModel,
	})
	@Expose()
	declare data: ShellyNgDiscoverySessionModel;
}

/**
 * Response wrapper for ShellyNgMappingReloadModel
 */
@ApiSchema({ name: 'DevicesShellyNgPluginResMappingReload' })
export class ShellyNgMappingReloadResponseModel extends BaseSuccessResponseModel<ShellyNgMappingReloadModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ShellyNgMappingReloadModel,
	})
	@Expose()
	declare data: ShellyNgMappingReloadModel;
}
