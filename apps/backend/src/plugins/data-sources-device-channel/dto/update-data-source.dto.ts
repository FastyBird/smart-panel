import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { UpdateDataSourceDto } from '../../../modules/dashboard/dto/update-data-source.dto';
import type { components } from '../../../openapi';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateChannelExists } from '../validators/device-channel-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

type UpdateDeviceChannelDataSource =
	components['schemas']['DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource'];

export class UpdateDeviceChannelDataSourceDto extends UpdateDataSourceDto implements UpdateDeviceChannelDataSource {
	readonly type: 'device-channel';

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateChannelExists({ message: '[{"field":"channel","reason":"The specified channel does not exist."}]' })
	channel?: string;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateChannelPropertyExists({
		message: '[{"field":"property","reason":"The specified property does not exist."}]',
	})
	property?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}
