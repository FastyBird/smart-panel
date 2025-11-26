import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

import { ShellyV1DeviceInfoModel, ShellyV1SupportedDeviceModel } from './shelly-v1.model';

/**
 * Response wrapper for ShellyV1DeviceInfoModel
 */
@ApiSchema({ name: 'DevicesShellyV1PluginResDeviceInfo' })
export class ShellyV1DeviceInfoResponseModel extends BaseSuccessResponseModel<ShellyV1DeviceInfoModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ShellyV1DeviceInfoModel,
	})
	@Expose()
	@Type(() => ShellyV1DeviceInfoModel)
	data: ShellyV1DeviceInfoModel;
}

/**
 * Response wrapper for array of ShellyV1SupportedDeviceModel
 */
@ApiSchema({ name: 'DevicesShellyV1PluginResSupportedDevices' })
export class ShellyV1SupportedDevicesResponseModel extends BaseSuccessResponseModel<ShellyV1SupportedDeviceModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(ShellyV1SupportedDeviceModel) },
	})
	@Expose()
	@Type(() => ShellyV1SupportedDeviceModel)
	data: ShellyV1SupportedDeviceModel[];
}
