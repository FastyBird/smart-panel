import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

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
	@Type(() => ShellyNgDeviceInfoModel)
	data: ShellyNgDeviceInfoModel;
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
	@Type(() => ShellyNgSupportedDeviceModel)
	data: ShellyNgSupportedDeviceModel[];
}
