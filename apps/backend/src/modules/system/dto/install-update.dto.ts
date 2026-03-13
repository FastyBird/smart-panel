import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleReqInstallUpdate' })
export class ReqInstallUpdateDto {
	@ApiPropertyOptional({ description: 'Specific version to install', type: 'string', example: '1.3.0' })
	@Expose()
	@IsOptional()
	@IsString()
	version?: string;

	@ApiPropertyOptional({
		description: 'Whether to allow major version updates',
		type: 'boolean',
		default: false,
	})
	@Expose({ name: 'allow_major' })
	@IsOptional()
	@IsBoolean()
	allowMajor?: boolean;
}
