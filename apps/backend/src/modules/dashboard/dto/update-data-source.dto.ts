import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateDeviceChannelExists } from '../validators/device-channel-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

import { UpdateCardDto } from './update-card.dto';

type ReqUpdateDataSource = components['schemas']['DashboardReqUpdateDataSource'];
type UpdateDataSourceBase = components['schemas']['DashboardUpdateDataSourceBase'];
type UpdateDeviceChannelDataSource = components['schemas']['DashboardUpdateDeviceChannelDataSource'];

export abstract class UpdateDataSourceDto implements UpdateDataSourceBase {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported data source type."}]' })
	readonly type: string;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"tile","reason":"Tile must be a valid UUID (version 4)."}]' })
	tile?: string;
}

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
	@ValidateDeviceChannelExists({ message: '[{"field":"channel","reason":"The specified channel does not exist."}]' })
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

export class ReqUpdateDataSourceDto implements ReqUpdateDataSource {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateCardDto)
	data: UpdateDeviceChannelDataSourceDto;
}
