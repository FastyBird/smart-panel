import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceDataInput } from '../../../modules/devices/services/device-validation.service';
import { AdoptHelperRequestDto } from '../dto/helper-mapping-preview.dto';

export const buildHelperDeviceStructure = (request: AdoptHelperRequestDto): DeviceDataInput => ({
	category: request.category,
	channels: [
		...request.channels.map((channel) => ({
			category: channel.category,
			properties: channel.properties.map((property) => ({
				category: property.category,
				dataType: property.dataType,
				permissions: property.permissions,
			})),
		})),
		{
			category: ChannelCategory.DEVICE_INFORMATION,
			properties: [
				{
					category: PropertyCategory.MANUFACTURER,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.MODEL,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.SERIAL_NUMBER,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.STATUS,
					dataType: DataTypeType.ENUM,
					permissions: [PermissionType.READ_ONLY],
				},
			],
		},
	],
});
