import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

import { ShellyNgDeviceInfoModel, ShellyNgSupportedDeviceModel } from './shelly-ng.model';

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
