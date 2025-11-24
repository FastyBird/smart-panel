import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class RegisteredDisplayResponseDto {
	@ApiProperty({
		description: 'Display account secret',
		type: 'string',
		example: 'IwMj3jfHdRVIxCck6DBgcQi3zXDNAHUu',
	})
	@Expose()
	@IsNotEmpty()
	@IsString()
	secret: string;
}
