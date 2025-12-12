import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleUpdateLocation' })
export class UpdateLocationDto {
	@ApiPropertyOptional({
		description: 'Location name',
		type: 'string',
		example: 'Home',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	name?: string;
}

@ApiSchema({ name: 'WeatherModuleReqUpdateLocation' })
export class ReqUpdateLocationDto {
	@ApiPropertyOptional({ description: 'Location data', type: () => UpdateLocationDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateLocationDto)
	data: UpdateLocationDto;
}
