import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateSingleTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { TILES_TIME_TYPE } from '../tiles-time.constants';

@ApiSchema({ name: 'TilesTimePluginCreateTimeTile' })
export class CreateTimeTileDto extends CreateSingleTileDto {
	readonly type: typeof TILES_TIME_TYPE;
}

@ApiSchema({ name: 'TilesTimePluginReqCreateTimeTile' })
export class ReqCreateTimeTileDto {
	@ApiProperty({
		description: 'Time tile creation data',
		type: () => CreateTimeTileDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateTimeTileDto)
	data: CreateTimeTileDto;
}
