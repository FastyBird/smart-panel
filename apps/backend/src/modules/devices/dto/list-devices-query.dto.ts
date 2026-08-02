import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

import { DeviceHiddenFilter } from '../devices.constants';

export class ListDevicesQueryDto {
	@ApiPropertyOptional({
		description: 'Filter by hidden flag. Defaults to returning every device.',
		enum: DeviceHiddenFilter,
		example: DeviceHiddenFilter.FALSE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(DeviceHiddenFilter)
	hidden?: DeviceHiddenFilter;
}
