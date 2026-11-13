import { Expose } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class SnapshotQueryDto {
	@ApiPropertyOptional({
		description: 'Stream profile whose camera channel the snapshot is taken from. Defaults to the camera default.',
		type: 'string',
		example: 'package',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	profile?: string;

	@ApiPropertyOptional({
		description: 'Request the highest quality image the camera offers. Defaults to false.',
		type: 'string',
		enum: ['true', 'false'],
		example: 'false',
	})
	@Expose()
	@IsOptional()
	@IsIn(['true', 'false'])
	hq?: 'true' | 'false';
}
