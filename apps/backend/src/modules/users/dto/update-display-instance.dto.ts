import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'UsersModuleUpdateDisplayInstance' })
export class UpdateDisplayInstanceDto {
	@ApiPropertyOptional({
		description: 'Semantic version of the display software',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"version","reason":"Version must be a non-empty string."}]' })
	@Matches(
		/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i,
		{
			message:
				'[{"field":"version","reason":"Version must follow full semantic versioning (e.g. 1.0.0, 1.0.0-beta+exp.sha.5114f85)."}]',
		},
	)
	version?: string;

	@ApiPropertyOptional({
		description: 'Build identifier for the display software',
		type: 'string',
		example: '20250124-1a2b3c4',
	})
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	build?: string;

	@ApiPropertyOptional({
		name: 'display_profile',
		description: 'Display profile ID to associate with this display instance',
		format: 'uuid',
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"display_profile","reason":"Display profile ID must be a valid UUID (version 4)."}]',
	})
	display_profile?: string;
}

@ApiSchema({ name: 'UsersModuleReqUpdateDisplayInstance' })
export class ReqUpdateDisplayInstanceDto {
	@ApiProperty({
		description: 'Display instance update data',
		type: () => UpdateDisplayInstanceDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayInstanceDto)
	data: UpdateDisplayInstanceDto;
}
