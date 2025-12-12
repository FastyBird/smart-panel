import { Expose, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'WeatherModuleReorderLocationItem' })
export class ReorderLocationItemDto {
	@ApiProperty({
		description: 'Location ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id: string;

	@ApiProperty({
		description: 'New display order (lower numbers appear first)',
		type: 'integer',
		example: 0,
	})
	@Expose()
	@IsInt({ message: '[{"field":"order","reason":"Order must be a valid integer."}]' })
	@Min(0, { message: '[{"field":"order","reason":"Order must be a non-negative integer."}]' })
	order: number;
}

@ApiSchema({ name: 'WeatherModuleReqReorderLocations' })
export class ReqReorderLocationsDto {
	@ApiProperty({
		description: 'Array of location IDs with their new order values',
		type: [ReorderLocationItemDto],
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(1, { message: '[{"field":"data","reason":"At least one location must be provided."}]' })
	@ValidateNested({ each: true })
	@Type(() => ReorderLocationItemDto)
	data: ReorderLocationItemDto[];
}
