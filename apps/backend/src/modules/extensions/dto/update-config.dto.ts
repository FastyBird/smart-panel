import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';

@ApiSchema({ name: 'ConfigModuleUpdateExtensions' })
export class UpdateExtensionsConfigDto extends UpdateModuleConfigDto {
	@ApiPropertyOptional({
		description: 'Module enabled state',
		type: 'boolean',
		example: true,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => obj.enabled, { toClassOnly: true })
	@IsBoolean()
	@IsOptional()
	enabled?: boolean;
}
