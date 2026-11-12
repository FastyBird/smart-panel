import { Expose, Type } from 'class-transformer';
import { IsDefined, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'CamerasModuleCreateSession' })
export class CreateCameraSessionDto {
	@ApiPropertyOptional({
		description: 'Stream profile to open. Defaults to the first available profile.',
		type: 'string',
		minLength: 1,
		maxLength: 64,
		example: 'medium',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"profile","reason":"Profile must be a string."}]' })
	@Length(1, 64, { message: '[{"field":"profile","reason":"Profile must be between 1 and 64 characters."}]' })
	profile?: string;

	@ApiProperty({ description: 'Live view transport', type: 'string', enum: ['mse'], example: 'mse' })
	@Expose()
	@IsIn(['mse'], { message: '[{"field":"transport","reason":"Transport must be mse."}]' })
	transport: 'mse';
}

@ApiSchema({ name: 'CamerasModuleReqCreateSession' })
export class ReqCreateCameraSessionDto {
	@ApiProperty({ description: 'Session data', type: () => CreateCameraSessionDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Session data is required."}]' })
	@ValidateNested()
	@Type(() => CreateCameraSessionDto)
	data: CreateCameraSessionDto;
}
