import { Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateDataSourceDto } from '../../../modules/dashboard/dto/update-data-source.dto';
import { DATA_SOURCES_DEVICE_TYPE } from '../data-sources-device-channel.constants';
import { ValidateChannelPropertyExists } from '../validators/channel-property-exists-constraint.validator';
import { ValidateChannelExists } from '../validators/device-channel-exists-constraint.validator';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

@ApiSchema({ name: 'DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource' })
export class UpdateDeviceChannelDataSourceDto extends UpdateDataSourceDto {
	readonly type: typeof DATA_SOURCES_DEVICE_TYPE;

	@ApiPropertyOptional({
		description: 'Device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;

	@ApiPropertyOptional({
		description: 'Channel ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateChannelExists({ message: '[{"field":"channel","reason":"The specified channel does not exist."}]' })
	channel?: string;

	@ApiPropertyOptional({
		description: 'Property ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateChannelPropertyExists({
		message: '[{"field":"property","reason":"The specified property does not exist."}]',
	})
	property?: string;

	@ApiPropertyOptional({
		description: 'Icon name',
		type: 'string',
		nullable: true,
		example: 'mdi:lightbulb',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;
}
