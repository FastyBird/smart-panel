import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';

@ApiSchema({ name: 'ExtensionsModuleUpdateExtensionsConfig' })
export class UpdateExtensionsConfigDto extends UpdateModuleConfigDto {
	@ApiPropertyOptional({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	@IsOptional()
	enabled?: boolean;
}
