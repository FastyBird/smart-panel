import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DashboardModuleParent' })
export class ParentDto {
	@ApiProperty({ description: 'Parent entity type', type: 'string', example: 'page' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"parent.type","reason":"Parent type is required."}]' })
	@IsString({ message: '[{"field":"parent.type","reason":"Parent type must be a string."}]' })
	type: string;

	@ApiProperty({
		description: 'Parent entity ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"parent.id","reason":"Parent ID must be a valid UUID (version 4)."}]' })
	id: string;
}
