import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CheckResponseDto {
	@ApiProperty({
		description: 'Indicates whether the provided validation field is valid.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	valid: boolean;
}
